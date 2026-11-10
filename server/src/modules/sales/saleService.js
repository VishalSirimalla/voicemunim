const mongoose = require("mongoose");
const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const parsePagination = require("../../utils/pagination");
const { toPaise, fromPaise } = require("../../utils/money");
const { toMilliunits } = require("../../utils/quantity");
const { fingerprint, runIdempotentTransaction } = require("../../utils/idempotency");

const paymentStatus = (totalAmount, amountPaid) => {
  if (amountPaid === 0) return "UNPAID";
  return amountPaid >= totalAmount ? "PAID" : "PARTIAL";
};

const create = async (shopId, data, idempotencyKey) => {
  const requestFingerprint = fingerprint(data);
  return runIdempotentTransaction(shopId, idempotencyKey, requestFingerprint, async (session) => {
    if (data.customerId) {
      if (!mongoose.isObjectIdOrHexString(data.customerId)) {
        throw new AppError("Invalid customerId", 400);
      }
      const customer = await Customer.findOne({ _id: data.customerId, shopId }).session(session);
      if (!customer) throw new AppError("Customer not found", 404);
    }

    const productIds = [...new Set(data.items.map((item) => item.productId.toLowerCase()))];
    const products = await Product.find({ _id: { $in: productIds }, shopId }).session(session);
    if (products.length !== productIds.length) throw new AppError("One or more products were not found", 404);
    const productsById = new Map(products.map((product) => [product.id.toLowerCase(), product]));
    const items = data.items.map(({ productId, quantity }) => {
      const product = productsById.get(productId.toLowerCase());
      const pricePaise = toPaise(product.price, "Product price");
      const quantityMilliunits = toMilliunits(quantity);
      const lineTotalBigInt =
        (BigInt(pricePaise) * BigInt(quantityMilliunits) + 500n) / 1000n;
      const lineTotalPaise = Number(lineTotalBigInt);
      if (!Number.isSafeInteger(lineTotalPaise)) {
        throw new AppError("Sale item total exceeds the supported amount", 400);
      }
      return {
        product,
        quantity,
        unitPrice: product.price,
        lineTotalPaise,
      };
    });
    const totalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
      throw new AppError("Sale total must be greater than zero and within the supported range", 400);
    }
    const totalAmount = fromPaise(totalPaise);
    const amountPaidPaise =
      data.amountPaid === undefined ? 0 : toPaise(data.amountPaid, "amountPaid");
    if (amountPaidPaise > totalPaise) {
      throw new AppError("amountPaid must be between zero and the sale total", 400);
    }
    if (amountPaidPaise < totalPaise && !data.customerId) {
      throw new AppError("A customer is required for an unpaid or partially paid sale", 400);
    }
    if (amountPaidPaise > 0 && !["CASH", "UPI", "CARD", "OTHER"].includes(data.paymentMethod)) {
      throw new AppError("A valid paymentMethod is required when amountPaid is greater than zero", 400);
    }
    if (amountPaidPaise === 0 && data.paymentMethod !== undefined) {
      throw new AppError("paymentMethod is only allowed when amountPaid is greater than zero", 400);
    }

    for (const item of items) {
      if (item.quantity > item.product.stock) {
        throw new AppError(
          `Insufficient stock for ${item.product.name}. Available: ${item.product.stock}`,
          409
        );
      }

      const update = await Product.updateOne(
        { _id: item.product._id, shopId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { session }
      );
      if (update.modifiedCount !== 1) {
        throw new AppError(
          `Insufficient stock for ${item.product.name}. Stock changed while confirming the sale; please refresh and try again.`,
          409
        );
      }
    }

    const [transaction] = await Transaction.create(
      [
        {
          type: "SALE",
          shopId,
          customerId: data.customerId || null,
          items: items.map(({ product, quantity, unitPrice }) => ({
            productId: product._id,
            quantity,
            unitPrice,
          })),
          totalAmount,
          amountPaid: fromPaise(amountPaidPaise),
          initialAmountPaid: fromPaise(amountPaidPaise),
          paymentStatus: paymentStatus(totalAmount, fromPaise(amountPaidPaise)),
          paymentMethod: data.paymentMethod,
          idempotencyKey,
          requestFingerprint,
        },
      ],
      { session }
    );
    return transaction;
  });
};

const list = async (shopId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const [transactions, total] = await Promise.all([
    Transaction.find({ shopId, type: "SALE" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments({ shopId, type: "SALE" }),
  ]);
  return { sales: transactions, pagination: { page, limit, total } };
};

const getById = async (shopId, id) => {
  const transaction = await Transaction.findOne({ _id: id, shopId, type: "SALE" });
  if (!transaction) throw new AppError("Sale not found", 404);
  return transaction;
};

module.exports = { create, list, getById };
