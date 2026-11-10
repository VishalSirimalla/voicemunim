const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const { getIdempotencyKey } = require("../../utils/idempotency");
const { toMilliunits } = require("../../utils/quantity");
const service = require("./stockService");

exports.change = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const unknown = Object.keys(body).find(
    (field) => !["type", "quantity", "direction"].includes(field)
  );
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  const { type, quantity, direction } = body;
  if (!["STOCK_IN", "STOCK_ADJUSTMENT"].includes(type)) {
    throw new AppError("type must be STOCK_IN or STOCK_ADJUSTMENT", 400);
  }
  toMilliunits(quantity);
  if (type === "STOCK_ADJUSTMENT" && !["ADD", "REMOVE"].includes(direction)) {
    throw new AppError("direction must be ADD or REMOVE for a stock adjustment", 400);
  }
  if (type === "STOCK_IN" && direction !== undefined) {
    throw new AppError("direction is not allowed for STOCK_IN", 400);
  }
  const result = await service.changeStock(
    req.auth.shopId,
    req.params.id,
    { type, quantity, ...(direction && { direction }) },
    getIdempotencyKey(req)
  );
  res.status(result.replay ? 200 : 201).json({ success: true, data: result.transaction });
});
