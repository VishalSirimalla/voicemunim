const mongoose = require("mongoose");
const Customer = require("../../models/Customer");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const { toPaise, fromPaise } = require("../../utils/money");
const { fingerprint, runIdempotentTransaction } = require("../../utils/idempotency");

const create = async (shopId, data, idempotencyKey) => {
  const requestFingerprint = fingerprint(data);
  return runIdempotentTransaction(shopId, idempotencyKey, requestFingerprint, async (session) => {
    if (!mongoose.isObjectIdOrHexString(data.customerId)) {
      throw new AppError("Invalid customerId", 400);
    }
    if (!["CASH", "UPI", "CARD", "OTHER"].includes(data.paymentMethod)) {
      throw new AppError("paymentMethod must be CASH, UPI, CARD, or OTHER", 400);
    }
    const customer = await Customer.findOne({ _id: data.customerId, shopId }).session(session);
    if (!customer) throw new AppError("Customer not found", 404);

    let remainingPaise = toPaise(data.amount, "amount", { allowZero: false });
    const sales = await Transaction.find({
      shopId,
      customerId: customer._id,
      type: "SALE",
      paymentStatus: { $ne: "PAID" },
    })
      .sort({ createdAt: 1, _id: 1 })
      .session(session);
    const allocations = [];
    for (const sale of sales) {
      const duePaise = toPaise(sale.totalAmount, "sale total") -
        toPaise(sale.amountPaid, "sale amountPaid");
      if (duePaise <= 0) continue;
      const allocatedPaise = Math.min(duePaise, remainingPaise);
      if (allocatedPaise === 0) break;
      sale.amountPaid = fromPaise(toPaise(sale.amountPaid, "sale amountPaid") + allocatedPaise);
      sale.paymentStatus = sale.amountPaid >= sale.totalAmount ? "PAID" : "PARTIAL";
      await sale.save({ session });
      allocations.push({ saleId: sale._id, amount: fromPaise(allocatedPaise) });
      remainingPaise -= allocatedPaise;
      if (remainingPaise === 0) break;
    }
    if (remainingPaise > 0) {
      throw new AppError("Payment exceeds the customer's outstanding balance", 409);
    }

    const [transaction] = await Transaction.create(
      [
        {
          type: "PAYMENT",
          shopId,
          customerId: customer._id,
          totalAmount: fromPaise(toPaise(data.amount, "amount", { allowZero: false })),
          paymentMethod: data.paymentMethod,
          allocations,
          idempotencyKey,
          requestFingerprint,
        },
      ],
      { session }
    );
    return transaction;
  });
};

module.exports = { create };
