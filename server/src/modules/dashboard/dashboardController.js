const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const service = require("./dashboardService");

const validateChartQuery = (query) => {
  const allowed = ["startDate", "endDate", "period"];
  const unknown = Object.keys(query).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown query parameter: ${unknown}`, 400);
};

exports.summary = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await service.summary(req.auth.shopId, req.shop.businessTimezone),
  });
});

exports.salesChart = asyncHandler(async (req, res) => {
  validateChartQuery(req.query);
  res.json({
    success: true,
    data: await service.salesChart(
      req.auth.shopId,
      req.query,
      req.shop.businessTimezone
    ),
  });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const allowed = ["page", "limit"];
  const unknown = Object.keys(req.query).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown query parameter: ${unknown}`, 400);
  res.json({
    success: true,
    data: await service.lowStock(req.auth.shopId, req.query),
  });
});
