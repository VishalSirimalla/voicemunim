const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const service = require("./customerService");

const validate = (body, required = []) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const allowed = ["name", "phone"];
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  const missing = required.find((field) => body[field] === undefined);
  if (missing) throw new AppError(`${missing} is required`, 400);
  for (const field of allowed) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      throw new AppError(`${field} must be a string`, 400);
    }
  }
};

exports.list = asyncHandler(async (req, res) => {
  if (req.query.search !== undefined && typeof req.query.search !== "string") {
    throw new AppError("search must be a string", 400);
  }
  res.json({ success: true, data: await service.list(req.auth.shopId, req.query) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.auth.shopId, req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  validate(req.body, ["name", "phone"]);
  res
    .status(201)
    .json({ success: true, data: await service.create(req.auth.shopId, req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  validate(req.body);
  if (!Object.keys(req.body).length) throw new AppError("At least one field is required", 400);
  res.json({
    success: true,
    data: await service.update(req.auth.shopId, req.params.id, req.body),
  });
});

exports.ledger = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.ledger(req.auth.shopId, req.params.id, req.query),
  });
});
