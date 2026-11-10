const mongoose = require("mongoose");

const isCurrencyAmount = (value) =>
  Number.isSafeInteger(Math.round(value * 100)) &&
  Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8;

const transactionItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: Number.EPSILON },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: isCurrencyAmount, message: "unitPrice must use at most two decimals" },
    },
    adjustmentDirection: { type: String, enum: ["ADD", "REMOVE"] },
  },
  { _id: false }
);

const allocationSchema = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    amount: {
      type: Number,
      required: true,
      min: Number.EPSILON,
      validate: { validator: isCurrencyAmount, message: "allocation amount must use at most two decimals" },
    },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: false,
    },
    type: {
      type: String,
      required: true,
      enum: ["SALE", "PAYMENT", "STOCK_IN", "STOCK_ADJUSTMENT"],
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    items: { type: [transactionItemSchema], default: [] },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: isCurrencyAmount, message: "totalAmount must use at most two decimals" },
    },
    amountPaid: {
      type: Number,
      min: 0,
      default: 0,
      validate: { validator: isCurrencyAmount, message: "amountPaid must use at most two decimals" },
    },
    initialAmountPaid: {
      type: Number,
      min: 0,
      validate: {
        validator: isCurrencyAmount,
        message: "initialAmountPaid must use at most two decimals",
      },
    },
    paymentStatus: { type: String, enum: ["PAID", "PARTIAL", "UNPAID"] },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "CARD", "OTHER"] },
    allocations: { type: [allocationSchema], default: [] },
    idempotencyKey: { type: String, maxlength: 128 },
    requestFingerprint: { type: String },
  },
  { timestamps: true }
);

transactionSchema.index(
  { shopId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      shopId: { $type: "objectId" },
      idempotencyKey: { $type: "string" },
    },
  }
);
transactionSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
transactionSchema.index({ shopId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ shopId: 1, "items.productId": 1 });

module.exports =
  mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
