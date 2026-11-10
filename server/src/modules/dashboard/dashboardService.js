const Product = require("../../models/Product");
const Customer = require("../../models/Customer");
const Transaction = require("../../models/Transaction");
const { getDateRange, parseDateKey, addCalendarDays } = require("../../utils/dateRange");
const parsePagination = require("../../utils/pagination");

const transactionDateMatch = (shopId, start, endExclusive, types) => ({
  shopId,
  type: { $in: types },
  createdAt: { $gte: start, $lt: endExclusive },
});

const aggregateCollections = async (shopId, start, endExclusive) => {
  const [result] = await Transaction.aggregate([
    {
      $match: transactionDateMatch(shopId, start, endExclusive, ["SALE", "PAYMENT"]),
    },
    {
      $group: {
        _id: null,
        collected: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$type", "SALE"] },
                  then: { $ifNull: ["$initialAmountPaid", 0] },
                },
                {
                  case: { $eq: ["$type", "PAYMENT"] },
                  then: "$totalAmount",
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
  ]);
  return result?.collected || 0;
};

const topProducts = async (shopId, start, endExclusive, limit = 5) =>
  Transaction.aggregate([
    { $match: transactionDateMatch(shopId, start, endExclusive, ["SALE"]) },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.quantity", "$items.unitPrice"] } },
      },
    },
    { $sort: { quantitySold: -1, revenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: Product.collection.name,
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$productId"] },
                  { $eq: ["$shopId", shopId] },
                ],
              },
            },
          },
          { $project: { name: 1, unit: 1 } },
        ],
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: "$product.name",
        unit: "$product.unit",
        quantitySold: 1,
        revenue: 1,
      },
    },
  ]);

const summary = async (shopId, timeZone) => {
  const today = getDateRange({ period: "daily" }, timeZone);
  const month = getDateRange({ period: "monthly" }, timeZone);
  const trailingMonthStart = new Date(Date.now() - 30 * 86400000);
  const [
    totalProducts,
    totalCustomers,
    dailySales,
    monthlySales,
    outstanding,
    lowStockCount,
    recentTransactions,
    recentSales,
    topSellingProducts,
    totalCollectionToday,
  ] = await Promise.all([
    Product.countDocuments({ shopId }),
    Customer.countDocuments({ shopId }),
    Transaction.aggregate([
      { $match: transactionDateMatch(shopId, today.start, today.endExclusive, ["SALE"]) },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Transaction.aggregate([
      { $match: transactionDateMatch(shopId, month.start, month.endExclusive, ["SALE"]) },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Transaction.aggregate([
      { $match: { shopId, type: "SALE" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $subtract: ["$totalAmount", "$amountPaid"] } },
        },
      },
    ]),
    Product.countDocuments({ shopId, $expr: { $lte: ["$stock", "$lowStockThreshold"] } }),
    Transaction.find({ shopId }).sort({ createdAt: -1 }).limit(10).lean(),
    Transaction.find({ shopId, type: "SALE" }).sort({ createdAt: -1 }).limit(10).lean(),
    topProducts(shopId, trailingMonthStart, new Date(), 5),
    aggregateCollections(shopId, today.start, today.endExclusive),
  ]);
  return {
    totalProducts,
    totalCustomers,
    totalSalesToday: dailySales[0]?.total || 0,
    totalSalesThisMonth: monthlySales[0]?.total || 0,
    totalCollectionToday,
    totalOutstanding: outstanding[0]?.total || 0,
    lowStockProductCount: lowStockCount,
    recentTransactions,
    recentSales,
    topSellingProducts,
  };
};

const salesChart = async (shopId, query, timeZone) => {
  const range = getDateRange(query, timeZone);
  const grouped = await Transaction.aggregate([
    {
      $match: transactionDateMatch(
        shopId,
        range.start,
        range.endExclusive,
        ["SALE", "PAYMENT"]
      ),
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timeZone },
        },
        sales: {
          $sum: { $cond: [{ $eq: ["$type", "SALE"] }, "$totalAmount", 0] },
        },
        collections: {
          $sum: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$type", "SALE"] },
                  then: { $ifNull: ["$initialAmountPaid", 0] },
                },
                {
                  case: { $eq: ["$type", "PAYMENT"] },
                  then: "$totalAmount",
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byDate = new Map(grouped.map((entry) => [entry._id, entry]));
  const start = parseDateKey(range.startDate, "startDate");
  return Array.from({ length: range.dayCount }, (_, index) => {
    const key = addCalendarDays(start, index).toISOString().slice(0, 10);
    const row = byDate.get(key);
    return { date: key, sales: row?.sales || 0, collections: row?.collections || 0 };
  });
};

const lowStock = async (shopId, query) => {
  const { page, limit, skip } = parsePagination({ page: query.page || 1, limit: query.limit || 100 });
  const filter = { shopId, $expr: { $lte: ["$stock", "$lowStockThreshold"] } };
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ stock: 1, name: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { products, pagination: { page, limit, total } };
};

module.exports = { summary, salesChart, lowStock, topProducts, aggregateCollections };
