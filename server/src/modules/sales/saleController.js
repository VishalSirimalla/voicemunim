const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const { getIdempotencyKey } = require("../../utils/idempotency");
const { toPaise } = require("../../utils/money");
const { toMilliunits } = require("../../utils/quantity");
const service = require("./saleService");

const paymentMethods = ["CASH", "UPI", "CARD", "OTHER"];
const MAX_SALE_ITEMS = 50;

exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.list(req.auth.shopId, req.query) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.auth.shopId, req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const allowed = ["customerId", "items", "amountPaid", "paymentMethod"];
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  if (
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > MAX_SALE_ITEMS
  ) {
    throw new AppError(`A sale must contain between 1 and ${MAX_SALE_ITEMS} items`, 400);
  }
  if (body.customerId !== undefined && !mongoose.isObjectIdOrHexString(body.customerId)) {
    throw new AppError("Invalid customerId", 400);
  }
  const productIds = new Set();
  for (const item of body.items) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((field) => !["productId", "quantity"].includes(field)) ||
      !mongoose.isObjectIdOrHexString(item.productId) ||
      productIds.has(String(item.productId).toLowerCase())
    ) {
      throw new AppError("Each item needs a unique valid productId and positive quantity", 400);
    }
    toMilliunits(item.quantity, "item quantity");
    productIds.add(String(item.productId).toLowerCase());
  }
  const amountPaidPaise =
    body.amountPaid === undefined ? 0 : toPaise(body.amountPaid, "amountPaid");
  if (amountPaidPaise > 0 && !paymentMethods.includes(body.paymentMethod)) {
    throw new AppError("paymentMethod must be CASH, UPI, CARD, or OTHER", 400);
  }
  if (amountPaidPaise === 0 && body.paymentMethod !== undefined) {
    throw new AppError("paymentMethod is only allowed when amountPaid is greater than zero", 400);
  }

  const result = await service.create(
    req.auth.shopId,
    {
      ...(body.customerId && { customerId: String(body.customerId) }),
      items: body.items.map((item) => ({
        productId: String(item.productId),
        quantity: item.quantity,
      })),
      ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid }),
      ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
    },
    getIdempotencyKey(req)
  );
  res.status(result.replay ? 200 : 201).json({ success: true, data: result.transaction });
});
