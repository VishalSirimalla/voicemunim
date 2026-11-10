const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const { toMilliunits } = require("../../utils/quantity");
const service = require("./productService");

const allowedFields = ["name", "category", "price", "unit", "stock", "lowStockThreshold"];
const validateFields = (body, requiredFields = []) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unknown.length) throw new AppError(`Unknown field: ${unknown[0]}`, 400);
  const missing = requiredFields.find((field) => body[field] === undefined);
  if (missing) throw new AppError(`${missing} is required`, 400);
  for (const field of ["price", "stock", "lowStockThreshold"]) {
    if (body[field] !== undefined && (!Number.isFinite(body[field]) || body[field] < 0)) {
      throw new AppError(`${field} must be a non-negative number`, 400);
    }
  }
  for (const field of ["stock", "lowStockThreshold"]) {
    if (body[field] !== undefined) toMilliunits(body[field], field, { allowZero: true });
  }
  if (
    body.price !== undefined &&
    (!Number.isSafeInteger(Math.round(body.price * 100)) ||
      Math.abs(body.price * 100 - Math.round(body.price * 100)) > 1e-8)
  ) {
    throw new AppError("price must use at most two decimal places and fit the supported range", 400);
  }
  for (const field of ["name", "category", "unit"]) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      throw new AppError(`${field} must be a string`, 400);
    }
  }
};

exports.list = asyncHandler(async (req, res) => {
  for (const field of ["search", "category"]) {
    if (req.query[field] !== undefined && typeof req.query[field] !== "string") {
      throw new AppError(`${field} must be a string`, 400);
    }
  }
  res.json({ success: true, data: await service.list(req.auth.shopId, req.query) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.auth.shopId, req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  validateFields(req.body, ["name", "price", "unit"]);
  res
    .status(201)
    .json({ success: true, data: await service.create(req.auth.shopId, req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  validateFields(req.body);
  if (!Object.keys(req.body).length) throw new AppError("At least one field is required", 400);
  res.json({
    success: true,
    data: await service.update(req.auth.shopId, req.params.id, req.body),
  });
});

exports.remove = asyncHandler(async (req, res) => {
  await service.remove(req.auth.shopId, req.params.id);
  res.status(204).end();
});
