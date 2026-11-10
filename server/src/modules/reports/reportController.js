const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const service = require("./reportService");

const validateQuery = (query, { pagination = false, limit = false } = {}) => {
  const allowed = ["startDate", "endDate", "period"];
  if (pagination) allowed.push("page", "limit");
  if (limit) allowed.push("limit");
  const unknown = Object.keys(query).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown query parameter: ${unknown}`, 400);
};

exports.sales = asyncHandler(async (req, res) => {
  validateQuery(req.query);
  res.json({ success: true, data: await service.sales(req.auth.shopId, req.shop, req.query) });
});

exports.daily = asyncHandler(async (req, res) => {
  if (Object.keys(req.query).length) {
    throw new AppError("Daily report does not accept query parameters", 400);
  }
  res.json({ success: true, data: await service.daily(req.auth.shopId, req.shop) });
});

exports.collections = asyncHandler(async (req, res) => {
  validateQuery(req.query);
  res.json({
    success: true,
    data: await service.collections(req.auth.shopId, req.shop, req.query),
  });
});

exports.outstanding = asyncHandler(async (req, res) => {
  validateQuery(req.query);
  res.json({ success: true, data: await service.outstanding(req.auth.shopId) });
});

exports.inventory = asyncHandler(async (req, res) => {
  validateQuery(req.query, { pagination: true });
  res.json({ success: true, data: await service.inventory(req.auth.shopId, req.query) });
});

exports.top = asyncHandler(async (req, res) => {
  validateQuery(req.query, { limit: true });
  res.json({
    success: true,
    data: await service.top(req.auth.shopId, req.shop, req.query),
  });
});

exports.lowStock = asyncHandler(async (req, res) => {
  validateQuery(req.query, { pagination: true });
  res.json({
    success: true,
    data: await service.lowStock(req.auth.shopId, req.query),
  });
});
