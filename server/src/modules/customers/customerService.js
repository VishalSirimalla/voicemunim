const Customer = require("../../models/Customer");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const parsePagination = require("../../utils/pagination");

const list = async (shopId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { shopId };
  if (query.search) {
    const search = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: search, $options: "i" };
  }
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);
  return { customers, pagination: { page, limit, total } };
};

const getById = async (shopId, id) => {
  const customer = await Customer.findOne({ _id: id, shopId });
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const create = async (shopId, data) => Customer.create({ ...data, shopId });

const update = async (shopId, id, data) => {
  const customer = await Customer.findOne({ _id: id, shopId });
  if (!customer) throw new AppError("Customer not found", 404);
  Object.assign(customer, data);
  await customer.save();
  return customer;
};

const ledger = async (shopId, id, query) => {
  const customer = await getById(shopId, id);
  const { page, limit, skip } = parsePagination(query);
  const [transactions, salesBalance] = await Promise.all([
    Transaction.find({ shopId, customerId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.aggregate([
      { $match: { shopId: customer.shopId, customerId: customer._id, type: "SALE" } },
      {
        $group: {
          _id: null,
          amountSold: { $sum: "$totalAmount" },
          amountPaid: { $sum: "$amountPaid" },
        },
      },
    ]),
  ]);
  const balance = salesBalance[0]
    ? Number((salesBalance[0].amountSold - salesBalance[0].amountPaid).toFixed(2))
    : 0;
  const total = await Transaction.countDocuments({ shopId, customerId: id });
  return {
    customer,
    balance,
    transactions,
    pagination: { page, limit, total },
  };
};

module.exports = { list, getById, create, update, ledger };
