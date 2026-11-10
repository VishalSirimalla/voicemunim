const mongoose = require("mongoose");
const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const parsePagination = require("../../utils/pagination");
const { getDateRange } = require("../../utils/dateRange");
const { aggregateCollections, topProducts } = require("../dashboard/dashboardService");

const parseRange = (shop, query) => getDateRange(query, shop.businessTimezone);

const sales = async (shopId, shop, query) => {
  const range = parseRange(shop, query);
  const match = {
    shopId,
    type: "SALE",
    createdAt: { $gte: range.start, $lt: range.endExclusive },
  };
  const [totals, transactions] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
          outstanding: { $sum: { $subtract: ["$totalAmount", "$amountPaid"] } },
        },
      },
    ]),
    Transaction.find(match).sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  const customerIds = [...new Set(
    transactions.map((transaction) => transaction.customerId?.toString()).filter(Boolean)
  )];
  const productIds = [...new Set(
    transactions.flatMap((transaction) =>
      transaction.items.map((item) => item.productId.toString())
    )
  )];
  const [customers, products] = await Promise.all([
    customerIds.length
      ? Customer.find({ _id: { $in: customerIds }, shopId }).select("_id name").lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds }, shopId }).select("_id name unit").lean()
      : [],
  ]);
  const customersById = new Map(customers.map((customer) => [customer._id.toString(), customer]));
  const productsById = new Map(products.map((product) => [product._id.toString(), product]));
  const salesList = transactions.map((transaction) => {
    const customer = transaction.customerId
      ? customersById.get(transaction.customerId.toString())
      : null;
    return {
      createdAt: transaction.createdAt,
      customerName: transaction.customerId
        ? customer?.name || "Unknown Customer"
        : "Walk-in Customer",
      items: transaction.items.map((item) => {
        const product = productsById.get(item.productId.toString());
        return {
          productName: product?.name || "Unknown Product",
          quantity: item.quantity,
          unit: product?.unit || "",
          unitPrice: item.unitPrice,
        };
      }),
      totalAmount: transaction.totalAmount,
      amountPaid: transaction.amountPaid,
      initialAmountPaid: transaction.initialAmountPaid,
      paymentStatus: transaction.paymentStatus,
      paymentMethod: transaction.paymentMethod,
    };
  });
  return {
    range: { startDate: range.startDate, endDate: range.endDate, timezone: range.timeZone },
    summary: totals[0] || { salesCount: 0, revenue: 0, outstanding: 0 },
    sales: salesList,
  };
};

const daily = async (shopId, shop) => {
  const query = { period: "daily" };
  const [saleReport, collectionReport, outstandingReport] = await Promise.all([
    sales(shopId, shop, query),
    collections(shopId, shop, query),
    outstanding(shopId),
  ]);
  return {
    date: saleReport.range.startDate,
    timezone: shop.businessTimezone,
    sales: saleReport.summary,
    collections: collectionReport.total,
    totalOutstanding: outstandingReport.totalOutstanding,
  };
};

const collections = async (shopId, shop, query) => {
  const range = parseRange(shop, query);
  const transactions = await Transaction.aggregate([
    {
      $match: {
        shopId,
        type: { $in: ["SALE", "PAYMENT"] },
        createdAt: { $gte: range.start, $lt: range.endExclusive },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: shop.businessTimezone } },
        amount: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "SALE"] }, then: { $ifNull: ["$initialAmountPaid", 0] } },
                { case: { $eq: ["$type", "PAYMENT"] }, then: "$totalAmount" },
              ],
              default: 0,
            },
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const total = transactions.reduce((sum, row) => sum + row.amount, 0);
  return {
    range: { startDate: range.startDate, endDate: range.endDate, timezone: range.timeZone },
    total,
    days: transactions,
  };
};

const outstanding = async (shopId) => {
  const customers = await Transaction.aggregate([
    { $match: { shopId, type: "SALE" } },
    {
      $group: {
        _id: "$customerId",
        amountSold: { $sum: "$totalAmount" },
        amountPaid: { $sum: "$amountPaid" },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $match: { $expr: { $gt: [{ $subtract: ["$amountSold", "$amountPaid"] }, 0] } } },
    {
      $lookup: {
        from: Customer.collection.name,
        let: { customerId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$customerId"] },
                  { $eq: ["$shopId", shopId] },
                ],
              },
            },
          },
          { $project: { name: 1, phone: 1 } },
        ],
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        _id: 0,
        customerId: "$_id",
        name: "$customer.name",
        phone: "$customer.phone",
        amountSold: 1,
        amountPaid: 1,
        outstanding: { $subtract: ["$amountSold", "$amountPaid"] },
      },
    },
    { $sort: { outstanding: -1 } },
  ]);
  return {
    customers,
    totalOutstanding: customers.reduce((sum, customer) => sum + customer.outstanding, 0),
  };
};

const inventory = async (shopId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { shopId };
  const [products, total, totals] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { shopId } },
      {
        $group: {
          _id: null,
          productCount: { $sum: 1 },
          stockUnits: { $sum: "$stock" },
          lowStockCount: {
            $sum: { $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, 1, 0] },
          },
          inventoryCost: { $sum: { $multiply: ["$stock", "$price"] } },
        },
      },
    ]),
  ]);
  return {
    summary: totals[0] || { productCount: 0, stockUnits: 0, lowStockCount: 0, inventoryCost: 0 },
    products,
    pagination: { page, limit, total },
  };
};

const top = async (shopId, shop, query) => {
  const range = parseRange(shop, query);
  const limit = Number(query.limit || 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("limit must be between 1 and 100", 400);
  }
  return {
    range: { startDate: range.startDate, endDate: range.endDate, timezone: range.timeZone },
    products: await topProducts(shopId, range.start, range.endExclusive, limit),
  };
};

const lowStock = async (shopId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { shopId, $expr: { $lte: ["$stock", "$lowStockThreshold"] } };
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ stock: 1, name: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { products, pagination: { page, limit, total } };
};

const collectionSummary = async (shopId, shop, query) => {
  const range = parseRange(shop, query);
  const total = await aggregateCollections(shopId, range.start, range.endExclusive);
  return {
    range: { startDate: range.startDate, endDate: range.endDate, timezone: range.timeZone },
    total,
  };
};

module.exports = {
  sales,
  daily,
  collections,
  outstanding,
  inventory,
  top,
  lowStock,
  collectionSummary,
};
