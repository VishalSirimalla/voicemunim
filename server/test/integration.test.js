const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
process.env.JWT_SECRET = "test-only-signing-secret-that-is-at-least-32-characters";
const mongoose = require("mongoose");
const app = require("../src/app");
const Customer = require("../src/models/Customer");
const Product = require("../src/models/Product");
const Transaction = require("../src/models/Transaction");
const Shop = require("../src/models/Shop");
const VoiceAction = require("../src/models/VoiceAction");
const { randomUUID } = require("node:crypto");

const uri = process.env.MONGODB_TEST_URI;
const runIntegrationTest = uri ? test : test.skip;
const keyPrefix = `integration-${randomUUID()}`;
const idempotencyKeys = [];
const additionalProductIds = [];
let server;
let baseUrl;
let shop;
let token;
let shopCredentials;
let otherShop;
let otherToken;
let customer;
let primaryProduct;
let secondProduct;

const request = async (path, method, body, key, accessToken = token) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      ...(key && { "Idempotency-Key": key }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

const registerShop = async (suffix) => {
  const credentials = {
    email: `${randomUUID()}@integration.test`,
    password: "integration-test-password",
  };
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shopName: `Integration ${suffix}`,
      ownerName: "Integration owner",
      email: credentials.email,
      phone: `+91${Date.now()}${Math.floor(Math.random() * 1000)}`,
      password: credentials.password,
    }),
  });
  assert.equal(response.status, 201);
  const data = (await response.json()).data;
  assert.equal(typeof data.token, "string");
  assert.ok(data.token.length > 0);
  return { ...data, credentials };
};

const nextKey = (name) => {
  const key = `${keyPrefix}-${name}`;
  idempotencyKeys.push(key);
  return key;
};

before(async () => {
  if (!uri) return;
  await mongoose.connect(uri);
  const topologyType = mongoose.connection.getClient().topology.description.type;
  if (!topologyType.startsWith("ReplicaSet")) {
    throw new Error("MONGODB_TEST_URI must connect to a MongoDB replica set");
  }
  if (!/(?:_test|test)$/i.test(mongoose.connection.name)) {
    throw new Error("MONGODB_TEST_URI must use a database name ending in test or _test");
  }
  if (!process.env.MONGODB_TEST_URI) {
    throw new Error("MONGODB_TEST_URI is required for integration tests");
  }

  await Promise.all([
    Shop.init(),
    Customer.init(),
    Product.init(),
    Transaction.init(),
    VoiceAction.init(),
  ]);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const registeredShop = await registerShop("primary");
  shop = await Shop.findById(registeredShop.shop._id).select("+tokenVersion");
  token = registeredShop.token;
  shopCredentials = registeredShop.credentials;
  const registeredOtherShop = await registerShop("other");
  otherShop = await Shop.findById(registeredOtherShop.shop._id);
  otherToken = registeredOtherShop.token;

  customer = await Customer.create({
    shopId: shop._id,
    name: "Integration customer",
    phone: `+91${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  primaryProduct = await Product.create({
    shopId: shop._id,
    name: "Integration item",
    price: 100.01,
    unit: "kg",
    stock: 10,
  });
  secondProduct = await Product.create({
    shopId: shop._id,
    name: "Concurrent integration item",
    price: 1,
    unit: "each",
    stock: 5,
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (mongoose.connection.readyState === 1) {
    await VoiceAction.deleteMany({ shopId: { $in: [shop?._id, otherShop?._id].filter(Boolean) } });
    await Transaction.deleteMany({ shopId: { $in: [shop?._id, otherShop?._id].filter(Boolean) } });
    await Product.deleteMany({
      _id: { $in: [primaryProduct?._id, secondProduct?._id, ...additionalProductIds].filter(Boolean) },
    });
    if (customer) await Customer.deleteOne({ _id: customer._id });
    if (shop) await Shop.deleteOne({ _id: shop._id });
    if (otherShop) await Shop.deleteOne({ _id: otherShop._id });
    await mongoose.disconnect();
  }
});

runIntegrationTest(
  "sales, payments, stock races, rollback, and idempotent concurrent retries",
  { timeout: 60000 },
  async () => {
    const saleKey = nextKey("uppercase-id");
    const uppercaseProductId = primaryProduct.id.toUpperCase();
    const saleBody = {
      customerId: customer.id,
      items: [{ productId: uppercaseProductId, quantity: 1 }],
    };
    const saleResponse = await request("/api/v1/sales", "POST", saleBody, saleKey);
    assert.equal(saleResponse.status, 201);
    const sale = (await saleResponse.json()).data;
    assert.equal(sale.totalAmount, 100.01);
    assert.equal((await Product.findById(primaryProduct._id)).stock, 9);

    const salesReportResponse = await request("/api/v1/reports/sales?period=monthly", "GET");
    assert.equal(salesReportResponse.status, 200);
    const salesReport = (await salesReportResponse.json()).data;
    const reportedSale = salesReport.sales.find((row) => row.totalAmount === sale.totalAmount);
    assert.equal(reportedSale.customerName, "Integration customer");
    assert.deepEqual(reportedSale.items[0], {
      productName: "Integration item",
      quantity: 1,
      unit: "kg",
      unitPrice: 100.01,
    });
    assert.equal("_id" in reportedSale, false);
    assert.equal("shopId" in reportedSale, false);
    assert.equal("customerId" in reportedSale, false);
    assert.equal("productId" in reportedSale.items[0], false);

    const stockKey = nextKey("stock-in");
    const stockBody = { type: "STOCK_IN", quantity: 1 };
    const stockResponses = await Promise.all([
      request(`/api/v1/products/${primaryProduct.id}/stock`, "POST", stockBody, stockKey),
      request(`/api/v1/products/${primaryProduct.id}/stock`, "POST", stockBody, stockKey),
    ]);
    assert.deepEqual(
      stockResponses.map((response) => response.status).sort(),
      [200, 201]
    );
    assert.equal((await Product.findById(primaryProduct._id)).stock, 10);
    const changedReplay = await request(
      `/api/v1/products/${primaryProduct.id}/stock`,
      "POST",
      { type: "STOCK_IN", quantity: 2 },
      stockKey
    );
    assert.equal(changedReplay.status, 409);
    assert.equal((await Product.findById(primaryProduct._id)).stock, 10);

    const overStockSaleKey = nextKey("over-stock-sale");
    const overStockSaleResponse = await request(
      "/api/v1/sales",
      "POST",
      {
        customerId: customer.id,
        items: [{ productId: primaryProduct.id, quantity: 11 }],
      },
      overStockSaleKey
    );
    assert.equal(overStockSaleResponse.status, 409);
    assert.match((await overStockSaleResponse.json()).error.message, /Insufficient stock.*Available: 10/);
    assert.equal((await Product.findById(primaryProduct._id)).stock, 10);
    assert.equal(await Transaction.countDocuments({ shopId: shop._id, idempotencyKey: overStockSaleKey }), 0);

    const rice = await Product.create({
      shopId: shop._id,
      name: "Rice stock adjustment test",
      price: 65,
      unit: "kg",
      stock: 20,
    });
    const sugar = await Product.create({
      shopId: shop._id,
      name: "Sugar stock adjustment test",
      price: 65,
      unit: "kg",
      stock: 20,
    });
    additionalProductIds.push(rice._id, sugar._id);

    const riceInResponse = await request(
      `/api/v1/products/${rice.id}/stock`,
      "POST",
      { type: "STOCK_IN", quantity: 5 },
      nextKey("rice-stock-in")
    );
    assert.equal(riceInResponse.status, 201);
    const riceInTransaction = (await riceInResponse.json()).data;
    assert.equal(riceInTransaction.type, "STOCK_IN");
    assert.equal((await Product.findById(rice._id)).stock, 25);

    const riceRemovalResponse = await request(
      `/api/v1/products/${rice.id}/stock`,
      "POST",
      { type: "STOCK_ADJUSTMENT", quantity: 2, direction: "REMOVE" },
      nextKey("rice-stock-remove")
    );
    assert.equal(riceRemovalResponse.status, 201);
    const riceRemovalTransaction = (await riceRemovalResponse.json()).data;
    assert.equal(riceRemovalTransaction.type, "STOCK_ADJUSTMENT");
    assert.equal(riceRemovalTransaction.items[0].adjustmentDirection, "REMOVE");
    assert.equal((await Product.findById(rice._id)).stock, 23);

    const sugarRemovalResponse = await request(
      `/api/v1/products/${sugar.id}/stock`,
      "POST",
      { type: "STOCK_ADJUSTMENT", quantity: 3, direction: "REMOVE" },
      nextKey("sugar-stock-remove")
    );
    assert.equal(sugarRemovalResponse.status, 201);
    const sugarRemovalTransaction = (await sugarRemovalResponse.json()).data;
    assert.equal(sugarRemovalTransaction.type, "STOCK_ADJUSTMENT");
    assert.equal(sugarRemovalTransaction.items[0].adjustmentDirection, "REMOVE");
    assert.equal((await Product.findById(sugar._id)).stock, 17);

    const invalidRemovalResponse = await request(
      `/api/v1/products/${sugar.id}/stock`,
      "POST",
      { type: "STOCK_ADJUSTMENT", quantity: 18, direction: "REMOVE" },
      nextKey("sugar-stock-underflow")
    );
    assert.equal(invalidRemovalResponse.status, 409);
    assert.equal((await Product.findById(sugar._id)).stock, 17);

    const paymentKey = nextKey("payment");
    const paymentResponse = await request(
      "/api/v1/payments",
      "POST",
      { customerId: customer.id, amount: 40, paymentMethod: "CASH" },
      paymentKey
    );
    assert.equal(paymentResponse.status, 201);
    assert.deepEqual(
      (await Transaction.findById(sale._id)).toObject().paymentStatus,
      "PARTIAL"
    );

    const ledgerResponse = await request(
      `/api/v1/customers/${customer.id}/ledger`,
      "GET"
    );
    assert.equal(ledgerResponse.status, 200);
    assert.equal((await ledgerResponse.json()).data.balance, 60.01);

    const overpaymentResponse = await request(
      "/api/v1/payments",
      "POST",
      { customerId: customer.id, amount: 60.02, paymentMethod: "UPI" },
      nextKey("overpayment")
    );
    assert.equal(overpaymentResponse.status, 409);
    assert.equal((await Transaction.findById(sale._id)).amountPaid, 40);

    const zeroValueProduct = await Product.create({
      shopId: shop._id,
      name: "Sub-paise integration item",
      price: 0.01,
      unit: "kg",
      stock: 4,
    });
    additionalProductIds.push(zeroValueProduct._id);
    const zeroValueResponse = await request(
      "/api/v1/sales",
      "POST",
      {
        customerId: customer.id,
        items: [{ productId: zeroValueProduct.id, quantity: 0.001 }],
      },
      nextKey("zero-value")
    );
    assert.equal(zeroValueResponse.status, 400);
    assert.equal((await Product.findById(zeroValueProduct._id)).stock, 4);

    const emptyStockProduct = await Product.create({
      shopId: shop._id,
      name: "Empty integration item",
      price: 1,
      unit: "each",
      stock: 0,
    });
    additionalProductIds.push(emptyStockProduct._id);

    const rollbackResponse = await request(
      "/api/v1/sales",
      "POST",
      {
        customerId: customer.id,
        items: [
          { productId: primaryProduct.id, quantity: 2 },
          { productId: emptyStockProduct.id, quantity: 1 },
        ],
      },
      nextKey("rollback")
    );
    assert.equal(rollbackResponse.status, 409);
    assert.equal((await Product.findById(primaryProduct._id)).stock, 10);

    const concurrentKey = nextKey("concurrent-replay");
    const concurrentBody = {
      customerId: customer.id,
      items: [{ productId: secondProduct.id, quantity: 2 }],
      amountPaid: 2,
      paymentMethod: "CASH",
    };
    const concurrentResponses = await Promise.all([
      request("/api/v1/sales", "POST", concurrentBody, concurrentKey),
      request("/api/v1/sales", "POST", concurrentBody, concurrentKey),
    ]);
    assert.deepEqual(
      concurrentResponses.map((response) => response.status).sort(),
      [200, 201]
    );
    const concurrentTransactions = await Promise.all(
      concurrentResponses.map((response) => response.json())
    );
    assert.equal(concurrentTransactions[0].data._id, concurrentTransactions[1].data._id);
    assert.equal((await Product.findById(secondProduct._id)).stock, 3);
    assert.equal(await Transaction.countDocuments({ idempotencyKey: concurrentKey }), 1);

    const walkInSaleKey = nextKey("walk-in-report");
    const walkInSaleResponse = await request(
      "/api/v1/sales",
      "POST",
      {
        items: [{ productId: primaryProduct.id, quantity: 1 }],
        amountPaid: primaryProduct.price,
        paymentMethod: "CASH",
      },
      walkInSaleKey
    );
    assert.equal(walkInSaleResponse.status, 201);

    const deletedCustomer = await Customer.create({
      shopId: shop._id,
      name: "Deleted report customer",
      phone: `+91${Date.now()}${Math.floor(Math.random() * 1000)}`,
    });
    const deletedCustomerSaleKey = nextKey("deleted-customer-report");
    const deletedCustomerSaleResponse = await request(
      "/api/v1/sales",
      "POST",
      {
        customerId: deletedCustomer.id,
        items: [{ productId: primaryProduct.id, quantity: 1 }],
        amountPaid: primaryProduct.price,
        paymentMethod: "CASH",
      },
      deletedCustomerSaleKey
    );
    assert.equal(deletedCustomerSaleResponse.status, 201);
    await Customer.deleteOne({ _id: deletedCustomer._id, shopId: shop._id });

    const fallbackReportResponse = await request("/api/v1/reports/sales?period=monthly", "GET");
    assert.equal(fallbackReportResponse.status, 200);
    const fallbackSales = (await fallbackReportResponse.json()).data.sales;
    assert.ok(fallbackSales.some((row) => row.customerName === "Walk-in Customer"));
    assert.ok(fallbackSales.some((row) => row.customerName === "Unknown Customer"));
  }
);

runIntegrationTest(
  "shop isolation, authenticated reports, and confirmed voice workflows",
  { timeout: 60000 },
  async () => {
    const hiddenProduct = await request(
      `/api/v1/products/${primaryProduct.id}`,
      "GET",
      undefined,
      undefined,
      otherToken
    );
    assert.equal(hiddenProduct.status, 404);
    const hiddenCustomer = await request(
      `/api/v1/customers/${customer.id}/ledger`,
      "GET",
      undefined,
      undefined,
      otherToken
    );
    assert.equal(hiddenCustomer.status, 404);

    const summaryResponse = await request("/api/v1/dashboard/summary", "GET");
    assert.equal(summaryResponse.status, 200);
    const summary = (await summaryResponse.json()).data;
    assert.equal(summary.totalProducts, 4);
    const dailyReportResponse = await request("/api/v1/reports/daily", "GET");
    assert.equal(dailyReportResponse.status, 200);
    assert.equal(typeof (await dailyReportResponse.json()).data.totalOutstanding, "number");
    const isolatedSummaryResponse = await request(
      "/api/v1/dashboard/summary",
      "GET",
      undefined,
      undefined,
      otherToken
    );
    assert.equal(isolatedSummaryResponse.status, 200);
    assert.equal((await isolatedSummaryResponse.json()).data.totalProducts, 0);

    const loginResponse = await request("/api/v1/auth/login", "POST", shopCredentials);
    assert.equal(loginResponse.status, 200);
    const loginData = (await loginResponse.json()).data;
    assert.equal(loginData.shop.passwordHash, undefined);
    const profileResponse = await request(
      "/api/v1/auth/me",
      "GET",
      undefined,
      undefined,
      loginData.token
    );
    assert.equal(profileResponse.status, 200);

    const tooManyItems = await request("/api/v1/sales", "POST", {
      items: Array.from({ length: 51 }, (_, index) => ({
        productId: index.toString(16).padStart(24, "0"),
        quantity: 1,
      })),
    }, nextKey("too-many"));
    assert.equal(tooManyItems.status, 400);
    const invalidSalePayment = await request("/api/v1/sales", "POST", {
      items: [{ productId: primaryProduct.id, quantity: 1 }],
      paymentMethod: "CASH",
    }, nextKey("method-without-payment"));
    assert.equal(invalidSalePayment.status, 400);

    const originalFetch = global.fetch;
    const originalGeminiConfig = {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
    };
    const mockedIntents = [
      {
        intent: "CREATE_SALE",
        customerName: "Integration customer",
        items: [{ productName: "Integration item", quantity: 1, unit: "किलो" }],
        payment: { type: "CREDIT" },
        query: null,
      },
      {
        intent: "RECORD_PAYMENT",
        customerName: "Integration customer",
        items: [],
        payment: { type: null, amount: 10, paymentMethod: "CASH" },
        query: null,
      },
    ];
    let intentIndex = 0;
    process.env.GEMINI_API_KEY = "integration-only-key";
    process.env.GEMINI_MODEL = "gemini-integration-test";
    global.fetch = (input, options) => {
      const url = String(input);
      if (url.startsWith("http://127.0.0.1")) return originalFetch(input, options);
      const intent = mockedIntents[intentIndex++];
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(intent) }] } }],
        }),
      });
    };

    try {
      const previewResponse = await request("/api/v1/voice/interpret", "POST", {
        transcription: "Integration customer ke liye ek kilo item udhar",
      });
      assert.equal(previewResponse.status, 200);
      const previewData = (await previewResponse.json()).data;
      assert.equal(previewData.requiresConfirmation, true);
      assert.equal(previewData.totalAmount, 100.01);
      const voiceActionId = previewData.actionId;

      await Product.updateOne({ _id: primaryProduct._id }, { $inc: { stock: 1 } });
      const stalePreviewResponse = await request("/api/v1/voice/confirm", "POST", {
        actionId: voiceActionId,
      });
      assert.equal(stalePreviewResponse.status, 409);
      assert.equal((await stalePreviewResponse.json()).data.reconfirmationRequired, true);

      const confirmation = await request("/api/v1/voice/confirm", "POST", {
        actionId: voiceActionId,
      });
      assert.equal(confirmation.status, 200);
      const voiceSale = (await confirmation.json()).data;
      assert.equal(voiceSale.totalAmount, 100.01);
      assert.equal((await Product.findById(primaryProduct._id)).stock, 10);

      const replay = await request("/api/v1/voice/confirm", "POST", {
        actionId: voiceActionId,
      });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).data._id, voiceSale._id);

      const paymentPreviewResponse = await request("/api/v1/voice/interpret", "POST", {
        transcription: "Integration customer se das rupaye cash mile",
      });
      assert.equal(paymentPreviewResponse.status, 200);
      const paymentPreview = (await paymentPreviewResponse.json()).data;
      assert.equal(paymentPreview.requiresConfirmation, true);
      assert.equal(paymentPreview.amount, 10);
      const paymentResponse = await request("/api/v1/voice/confirm", "POST", {
        actionId: paymentPreview.actionId,
      });
      assert.equal(paymentResponse.status, 200);
      assert.equal((await paymentResponse.json()).data.type, "PAYMENT");
    } finally {
      global.fetch = originalFetch;
      for (const [key, value] of Object.entries({
        GEMINI_API_KEY: originalGeminiConfig.apiKey,
        GEMINI_MODEL: originalGeminiConfig.model,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const otherSalesResponse = await request(
      "/api/v1/sales",
      "POST",
      { items: [{ productId: primaryProduct.id, quantity: 1 }] },
      nextKey("cross-shop-sale"),
      otherToken
    );
    assert.equal(otherSalesResponse.status, 404);

    const oldToken = token;
    const passwordChange = await request("/api/v1/auth/password", "PUT", {
      currentPassword: shopCredentials.password,
      newPassword: "integration-test-password-updated",
    });
    assert.equal(passwordChange.status, 200);
    const invalidated = await request(
      "/api/v1/auth/me",
      "GET",
      undefined,
      undefined,
      oldToken
    );
    assert.equal(invalidated.status, 401);
    const newLogin = await request("/api/v1/auth/login", "POST", {
      email: shopCredentials.email,
      password: "integration-test-password-updated",
    });
    assert.equal(newLogin.status, 200);
  }
);
