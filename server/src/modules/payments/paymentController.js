const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const { getIdempotencyKey } = require("../../utils/idempotency");
const { toPaise } = require("../../utils/money");
const service = require("./paymentService");

const paymentMethods = ["CASH", "UPI", "CARD", "OTHER"];

exports.create = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const unknown = Object.keys(body).find(
    (field) => !["customerId", "amount", "paymentMethod"].includes(field)
  );
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  if (!mongoose.isObjectIdOrHexString(body.customerId)) {
    throw new AppError("Invalid customerId", 400);
  }
  toPaise(body.amount, "amount", { allowZero: false });
  if (!paymentMethods.includes(body.paymentMethod)) {
    throw new AppError("paymentMethod must be CASH, UPI, CARD, or OTHER", 400);
  }
  const result = await service.create(
    req.auth.shopId,
    {
      customerId: String(body.customerId),
      amount: body.amount,
      paymentMethod: body.paymentMethod,
    },
    getIdempotencyKey(req)
  );
  res.status(result.replay ? 200 : 201).json({ success: true, data: result.transaction });
});
