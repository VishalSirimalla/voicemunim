const mongoose = require("mongoose");
const Product = require("../../models/Product");
const Customer = require("../../models/Customer");
const Transaction = require("../../models/Transaction");
const VoiceAction = require("../../models/VoiceAction");
const AppError = require("../../utils/appError");
const { toPaise, fromPaise } = require("../../utils/money");
const { toMilliunits } = require("../../utils/quantity");
const customerService = require("../customers/customerService");
const dashboardService = require("../dashboard/dashboardService");
const paymentService = require("../payments/paymentService");
const saleService = require("../sales/saleService");
const { extractIntent } = require("../../services/intent/llmProvider");

const ACTION_TTL_MS = 10 * 60 * 1000;
const PROCESSING_LEASE_MS = 60 * 1000;
const normalize = (value) => value.normalize("NFKC").trim().toLocaleLowerCase("en-IN");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEVANAGARI_CONSONANTS = new Map(Object.entries({
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh",
  ष: "sh", स: "s", ह: "h", ळ: "l",
}));
const DEVANAGARI_VOWELS = new Map(Object.entries({
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
}));
const DEVANAGARI_MATRAS = new Set(["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ"]);
const transliterateHindi = (value) => {
  let transliterated = "";
  let pendingSchwa = false;
  for (const character of value) {
    if (DEVANAGARI_CONSONANTS.has(character)) {
      transliterated += `${DEVANAGARI_CONSONANTS.get(character)}a`;
      pendingSchwa = true;
    } else if (DEVANAGARI_VOWELS.has(character)) {
      if (DEVANAGARI_MATRAS.has(character) && pendingSchwa) {
        transliterated = transliterated.slice(0, -1);
      }
      transliterated += DEVANAGARI_VOWELS.get(character);
      pendingSchwa = false;
    } else if (character === "्") {
      if (pendingSchwa) transliterated = transliterated.slice(0, -1);
      pendingSchwa = false;
    } else if (character === "ं" || character === "ँ") {
      transliterated += "n";
      pendingSchwa = false;
    } else if (character === "ः") {
      transliterated += "h";
      pendingSchwa = false;
    } else if (character !== "़" && character !== "‍" && character !== "‌") {
      transliterated += character;
      pendingSchwa = false;
    }
  }
  return pendingSchwa ? transliterated.slice(0, -1) : transliterated;
};
const customerNameVariants = (value) => {
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("en-IN");
  const variants = new Set([normalized, normalized.replace(/\s+/g, " ")]);
  if (/[\u0900-\u097f]/u.test(normalized)) {
    const transliterated = transliterateHindi(normalized).trim().replace(/\s+/g, " ");
    if (transliterated !== normalized) variants.add(transliterated);
  }
  return [...variants].filter(Boolean);
};
const UNIT_ALIASES = new Map([
  ["kg", "kg"],
  ["kilo", "kg"],
  ["kilos", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["किलो", "kg"],
  ["किलोग्राम", "kg"],
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["ग्राम", "g"],
  ["packet", "packet"],
  ["packets", "packet"],
  ["pack", "packet"],
  ["pkt", "packet"],
  ["पैकेट", "packet"],
  ["piece", "piece"],
  ["pieces", "piece"],
  ["pc", "piece"],
  ["pcs", "piece"],
  ["पीस", "piece"],
  ["नग", "piece"],
  ["l", "l"],
  ["liter", "l"],
  ["litre", "l"],
  ["लीटर", "l"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["millilitre", "ml"],
  ["मिलीलीटर", "ml"],
]);
const normalizeUnit = (value) => {
  const normalized = normalize(value);
  return UNIT_ALIASES.get(normalized) || normalized;
};

const resolveProduct = async (shopId, requested) => {
  const name = requested.productName.trim();
  const exact = await Product.find({ shopId, nameNormalized: normalize(name) })
    .select("+nameNormalized")
    .limit(5);
  let candidates = exact;
  if (!candidates.length) {
    candidates = await Product.find({
      shopId,
      name: { $regex: escapeRegex(name), $options: "i" },
    })
      .limit(5);
  }
  if (!candidates.length) {
    return { clarification: `Could not find a product matching "${name}".` };
  }
  if (candidates.length > 1) {
    return {
      clarification: `More than one product matches "${name}". Please specify which one.`,
      candidates: candidates.map(({ id, name: productName, unit }) => ({
        productId: id,
        name: productName,
        unit,
      })),
    };
  }
  const product = candidates[0];
  if (requested.unit && normalizeUnit(requested.unit) !== normalizeUnit(product.unit)) {
    return {
      clarification: `"${product.name}" is measured in ${product.unit}, not ${requested.unit}.`,
      candidates: [{ productId: product.id, name: product.name, unit: product.unit }],
    };
  }
  return { product };
};

const resolveCustomer = async (shopId, requestedName) => {
  if (!requestedName) return { clarification: "Please specify the customer." };
  const name = requestedName.trim();
  const nameVariants = customerNameVariants(name);
  let candidates = await Customer.find({ shopId, nameNormalized: { $in: nameVariants } })
    .select("+nameNormalized")
    .limit(5);
  if (!candidates.length) {
    candidates = await Customer.find({
      shopId,
      $or: nameVariants.map((variant) => ({
        name: { $regex: escapeRegex(variant), $options: "i" },
      })),
    }).limit(5);
  }
  if (!candidates.length) {
    return { clarification: `Could not find a customer matching "${name}".` };
  }
  if (candidates.length > 1) {
    return {
      clarification: `More than one customer matches "${name}". Please specify which one.`,
      candidates: candidates.map(({ id, name: customerName, phone }) => ({
        customerId: id,
        name: customerName,
        phone,
      })),
    };
  }
  return { customer: candidates[0] };
};

const lineTotalPaise = (price, quantity) => {
  const pricePaise = toPaise(price, "Product price");
  const quantityMilliunits = toMilliunits(quantity);
  const total = Number((BigInt(pricePaise) * BigInt(quantityMilliunits) + 500n) / 1000n);
  if (!Number.isSafeInteger(total)) throw new AppError("Sale item total exceeds the supported amount", 400);
  return { pricePaise, quantityMilliunits, total };
};

const resolveProducts = async (shopId, requestedItems) => {
  if (!requestedItems.length) return { clarification: "Please specify at least one product." };
  const items = [];
  for (const requested of requestedItems) {
    const result = await resolveProduct(shopId, requested);
    if (!result.product) return result;
    const amounts = lineTotalPaise(result.product.price, requested.quantity);
    items.push({
      product: result.product,
      quantity: requested.quantity,
      pricePaise: amounts.pricePaise,
      lineTotalPaise: amounts.total,
      stockMilliunits: toMilliunits(result.product.stock, "Current stock", { allowZero: true }),
    });
  }
  return { items };
};

const salePreview = (customer, items, amountPaidPaise, paymentMethod) => {
  const totalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new AppError("Sale total must be greater than zero", 400);
  }
  const stockIssues = items
    .filter((item) => item.stockMilliunits < toMilliunits(item.quantity))
    .map((item) => ({
      productName: item.product.name,
      availableStock: item.product.stock,
      requestedQuantity: item.quantity,
      unit: item.product.unit,
    }));
  return {
    customer: customer ? { customerId: customer.id, name: customer.name } : null,
    items: items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit,
      unitPrice: fromPaise(item.pricePaise),
      lineTotal: fromPaise(item.lineTotalPaise),
      stock: item.product.stock,
    })),
    totalAmount: fromPaise(totalPaise),
    amountPaid: fromPaise(amountPaidPaise),
    outstandingAmount: fromPaise(totalPaise - amountPaidPaise),
    stockIssues,
    paymentMethod: paymentMethod || null,
    requiresConfirmation: true,
  };
};

const savePending = async (shopId, intent, requestData, preview, snapshot) => {
  const action = await VoiceAction.create({
    shopId,
    intent,
    requestData,
    preview,
    snapshot,
    expiresAt: new Date(Date.now() + ACTION_TTL_MS),
  });
  return {
    actionId: action.id,
    intent,
    ...preview,
    expiresAt: action.expiresAt,
  };
};

const processIntent = async (shopId, shop, intent) => {
  if (intent.intent === "UNKNOWN_INTENT") {
    return { intent, requiresConfirmation: false, clarification: "I could not identify the requested action." };
  }
  if (intent.intent === "DAILY_SALES_REPORT") {
    return {
      intent,
      requiresConfirmation: false,
      result: await dashboardService.summary(shopId, shop.businessTimezone),
    };
  }
  if (intent.intent === "LOW_STOCK_REPORT") {
    return {
      intent,
      requiresConfirmation: false,
      result: await dashboardService.lowStock(shopId, {}),
    };
  }
  if (intent.intent === "CHECK_CUSTOMER_BALANCE") {
    const resolution = await resolveCustomer(shopId, intent.customerName);
    if (!resolution.customer) return { intent, requiresConfirmation: false, ...resolution };
    const ledger = await customerService.ledger(shopId, resolution.customer.id, {});
    return {
      intent,
      requiresConfirmation: false,
      result: { customer: resolution.customer.toSafeObject?.() || resolution.customer, balance: ledger.balance },
    };
  }
  if (intent.intent === "CHECK_STOCK" || intent.intent === "SEARCH_PRODUCT") {
    const requested = intent.items.length
      ? intent.items
      : intent.query
        ? [{ productName: intent.query, quantity: 1, unit: "" }]
        : [];
    const resolution = await resolveProducts(shopId, requested);
    if (!resolution.items) return { intent, requiresConfirmation: false, ...resolution };
    return {
      intent,
      requiresConfirmation: false,
      result: resolution.items.map(({ product }) => ({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
      })),
    };
  }
  if (intent.intent === "CREATE_SALE") {
    const resolution = await resolveProducts(shopId, intent.items);
    if (!resolution.items) return { intent, requiresConfirmation: false, ...resolution };
    const payment = intent.payment || {};
    const provisionalTotal = resolution.items.reduce(
      (sum, item) => sum + item.lineTotalPaise,
      0
    );
    if (provisionalTotal <= 0) {
      throw new AppError("Sale total must be greater than zero", 400);
    }
    let amountPaidPaise = 0;
    if (payment.type === "PAID") {
      amountPaidPaise = provisionalTotal;
    } else if (payment.type === "PARTIAL") {
      if (payment.amount === null || payment.amount === undefined) {
        return { intent, requiresConfirmation: false, clarification: "Please specify the payment amount." };
      }
      amountPaidPaise = toPaise(payment.amount, "Payment amount", { allowZero: false });
    } else if (payment.type !== "CREDIT") {
      return {
        intent,
        requiresConfirmation: false,
        clarification: "Please clarify whether this sale is paid, partially paid, or on credit.",
      };
    }
    if (amountPaidPaise > provisionalTotal) {
      return {
        intent,
        requiresConfirmation: false,
        clarification: "Payment amount cannot exceed the sale total.",
      };
    }

    const customerResolution =
      intent.customerName ? await resolveCustomer(shopId, intent.customerName) : { customer: null };
    if (!customerResolution.customer && intent.customerName) {
      return { intent, requiresConfirmation: false, ...customerResolution };
    }
    if (amountPaidPaise < provisionalTotal && !customerResolution.customer) {
      return { intent, requiresConfirmation: false, clarification: "A customer is required for a credit sale." };
    }
    if (amountPaidPaise > 0 && !["CASH", "UPI", "CARD", "OTHER"].includes(payment.paymentMethod)) {
      return { intent, requiresConfirmation: false, clarification: "Please specify a supported payment method." };
    }
    if (amountPaidPaise === 0 && payment.paymentMethod) {
      return { intent, requiresConfirmation: false, clarification: "Payment method was provided for a zero payment." };
    }

    const preview = salePreview(
      customerResolution.customer,
      resolution.items,
      amountPaidPaise,
      payment.paymentMethod
    );
    if (preview.stockIssues.length) {
      return { intent, requiresConfirmation: false, ...preview, clarification: "Requested quantity exceeds available stock." };
    }
    const requestData = {
      ...(customerResolution.customer && { customerId: customerResolution.customer.id }),
      items: resolution.items.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
      ...(payment.paymentMethod && { paymentMethod: payment.paymentMethod }),
      ...(amountPaidPaise > 0 && { amountPaid: fromPaise(amountPaidPaise) }),
    };
    const snapshot = {
      products: resolution.items.map(({ product, pricePaise, stockMilliunits }) => ({
        productId: product.id,
        pricePaise,
        stockMilliunits,
      })),
    };
    return {
      intent,
      ...(await savePending(shopId, "CREATE_SALE", requestData, preview, snapshot)),
    };
  }
  if (intent.intent === "RECORD_PAYMENT") {
    const customerResolution = await resolveCustomer(shopId, intent.customerName);
    if (!customerResolution.customer) {
      return { intent, requiresConfirmation: false, ...customerResolution };
    }
    if (!intent.payment || !["CASH", "UPI", "CARD", "OTHER"].includes(intent.payment.paymentMethod)) {
      return {
        intent,
        requiresConfirmation: false,
        clarification: "Please specify a supported payment method.",
      };
    }
    if (intent.payment.amount === null || intent.payment.amount === undefined) {
      return { intent, requiresConfirmation: false, clarification: "Please specify the payment amount." };
    }
    const amountPaise = toPaise(intent.payment.amount, "Payment amount", { allowZero: false });
    const ledger = await customerService.ledger(shopId, customerResolution.customer.id, {});
    const balancePaise = toPaise(ledger.balance, "Customer outstanding balance");
    if (amountPaise > balancePaise) {
      return {
        intent,
        requiresConfirmation: false,
        clarification: "Payment exceeds the customer's current outstanding balance.",
        outstandingBalance: ledger.balance,
      };
    }
    const preview = {
      customer: { customerId: customerResolution.customer.id, name: customerResolution.customer.name },
      amount: fromPaise(amountPaise),
      paymentMethod: intent.payment.paymentMethod,
      outstandingBefore: ledger.balance,
      outstandingAfter: fromPaise(balancePaise - amountPaise),
      requiresConfirmation: true,
    };
    return {
      intent,
      ...(await savePending(
        shopId,
        "RECORD_PAYMENT",
        {
          customerId: customerResolution.customer.id,
          amount: fromPaise(amountPaise),
          paymentMethod: intent.payment.paymentMethod,
        },
        preview,
        { outstandingPaise: balancePaise }
      )),
    };
  }
  return { intent, requiresConfirmation: false, clarification: "This action is not supported." };
};

const processTranscript = async (shopId, shop, transcript) => {
  if (typeof transcript !== "string" || transcript.trim().length === 0 || transcript.length > 5000) {
    throw new AppError("transcription must contain between 1 and 5000 characters", 400);
  }
  const intent = await extractIntent(transcript.trim());
  return { transcript: transcript.trim(), ...await processIntent(shopId, shop, intent) };
};

const currentSalePreview = async (action, shopId) => {
  const products = await Product.find({
    shopId,
    _id: { $in: action.requestData.items.map((item) => item.productId) },
  });
  if (products.length !== action.requestData.items.length) {
    return { changed: true, reason: "A product is no longer available to this shop." };
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = action.requestData.items.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    const amounts = lineTotalPaise(product.price, quantity);
    return {
      product,
      quantity,
      pricePaise: amounts.pricePaise,
      lineTotalPaise: amounts.total,
      stockMilliunits: toMilliunits(product.stock, "Current stock", { allowZero: true }),
    };
  });
  const oldSnapshot = new Map(action.snapshot.products.map((product) => [product.productId, product]));
  const changed = items.some((item) => {
    const previous = oldSnapshot.get(item.product.id);
    return (
      !previous ||
      previous.pricePaise !== item.pricePaise ||
      previous.stockMilliunits !== item.stockMilliunits
    );
  });
  const customer = action.requestData.customerId
    ? await Customer.findOne({ _id: action.requestData.customerId, shopId })
    : null;
  const amountPaidPaise = action.requestData.amountPaid
    ? toPaise(action.requestData.amountPaid, "amountPaid")
    : 0;
  const preview = salePreview(customer, items, amountPaidPaise, action.requestData.paymentMethod);
  if (preview.stockIssues.length) {
    return { changed: true, reason: "Available stock changed and is now insufficient.", preview, items };
  }
  if (amountPaidPaise > toPaise(preview.totalAmount, "Sale total")) {
    return { changed: true, reason: "The updated sale total is less than the recorded payment.", preview, items };
  }
  return { changed, preview, items };
};

const reconfirm = async (action, current, message) => {
  action.status = "PENDING";
  action.processingAt = undefined;
  if (current.preview) action.preview = current.preview;
  if (current.items) {
    action.snapshot = {
      products: current.items.map(({ product, pricePaise, stockMilliunits }) => ({
        productId: product.id,
        pricePaise,
        stockMilliunits,
      })),
    };
  }
  await action.save();
  return {
    reconfirmationRequired: true,
    message,
    actionId: action.id,
    intent: action.intent,
    preview: action.preview,
    expiresAt: action.expiresAt,
  };
};

const confirm = async (shopId, actionId) => {
  if (!mongoose.isObjectIdOrHexString(actionId)) throw new AppError("Invalid actionId", 400);
  const existing = await VoiceAction.findOne({ _id: actionId, shopId });
  if (!existing) throw new AppError("Pending action not found", 404);
  if (existing.expiresAt <= new Date()) {
    await VoiceAction.updateOne({ _id: actionId, shopId }, { $set: { status: "EXPIRED" } });
    throw new AppError("Pending action has expired", 410);
  }
  if (existing.status === "CONFIRMED" && existing.transactionId) {
    const transaction = await Transaction.findOne({
      _id: existing.transactionId,
      shopId,
    });
    if (!transaction) throw new AppError("Confirmed transaction is unavailable", 500);
    return { transaction, replay: true };
  }

  const now = new Date();
  const action = await VoiceAction.findOneAndUpdate(
    {
      _id: actionId,
      shopId,
      expiresAt: { $gt: now },
      $or: [
        { status: "PENDING" },
        {
          status: "PROCESSING",
          processingAt: { $lt: new Date(now.getTime() - PROCESSING_LEASE_MS) },
        },
      ],
    },
    { $set: { status: "PROCESSING", processingAt: now } },
    { returnDocument: "after" }
  );
  if (!action) throw new AppError("Pending action is already being processed or is no longer available", 409);

  try {
    if (action.intent === "CREATE_SALE") {
      const current = await currentSalePreview(action, shopId);
      if (current.changed) {
        return reconfirm(action, current, current.reason || "Product price or stock changed. Review and confirm the updated preview.");
      }
      const result = await saleService.create(
        shopId,
        action.requestData,
        `voice-${action.id}`
      );
      action.status = "CONFIRMED";
      action.transactionId = result.transaction._id;
      action.confirmedAt = new Date();
      await action.save();
      return result;
    }

    const ledger = await customerService.ledger(
      shopId,
      action.requestData.customerId,
      {}
    );
    const outstandingPaise = toPaise(ledger.balance, "Customer outstanding balance");
    if (outstandingPaise !== action.snapshot.outstandingPaise) {
      const amountPaise = toPaise(action.requestData.amount, "Payment amount");
      action.preview.outstandingBefore = ledger.balance;
      action.preview.outstandingAfter = fromPaise(outstandingPaise - amountPaise);
      if (amountPaise > outstandingPaise) {
        return reconfirm(
          action,
          {},
          "The customer's outstanding balance changed and is now below this payment. Start a new payment request."
        );
      }
      action.snapshot.outstandingPaise = outstandingPaise;
      action.status = "PENDING";
      action.processingAt = undefined;
      await action.save();
      return {
        reconfirmationRequired: true,
        message: "Outstanding balance changed. Review and confirm the updated preview.",
        actionId: action.id,
        intent: action.intent,
        preview: action.preview,
        expiresAt: action.expiresAt,
      };
    }
    const result = await paymentService.create(
      shopId,
      action.requestData,
      `voice-${action.id}`
    );
    action.status = "CONFIRMED";
    action.transactionId = result.transaction._id;
    action.confirmedAt = new Date();
    await action.save();
    return result;
  } catch (error) {
    await VoiceAction.updateOne(
      { _id: action._id, shopId, status: "PROCESSING" },
      { $set: { status: "PENDING" }, $unset: { processingAt: 1 } }
    );
    throw error;
  }
};

const cancel = async (shopId, actionId) => {
  if (!mongoose.isObjectIdOrHexString(actionId)) throw new AppError("Invalid actionId", 400);
  const action = await VoiceAction.findOneAndUpdate(
    { _id: actionId, shopId, status: "PENDING", expiresAt: { $gt: new Date() } },
    { $set: { status: "CANCELLED" } },
    { returnDocument: "after" }
  );
  if (!action) throw new AppError("Pending action not found or cannot be cancelled", 404);
  return { actionId: action.id, status: action.status };
};

module.exports = {
  processTranscript,
  confirm,
  cancel,
  resolveProduct,
  resolveCustomer,
  salePreview,
};
