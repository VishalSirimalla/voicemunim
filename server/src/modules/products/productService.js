const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const parsePagination = require("../../utils/pagination");
const runInTransaction = require("../../utils/transaction");

const list = async (shopId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { shopId };
  if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: "i" };
  if (query.category) filter.category = query.category;

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { products, pagination: { page, limit, total } };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getById = async (shopId, id) => {
  const product = await Product.findOne({ _id: id, shopId });
  if (!product) throw new AppError("Product not found", 404);
  return product;
};

const create = async (shopId, data) => Product.create({ ...data, shopId });

const update = async (shopId, id, data) => {
  if (Object.prototype.hasOwnProperty.call(data, "stock")) {
    throw new AppError("Use the stock adjustment endpoint to change stock", 400);
  }
  const product = await Product.findOne({ _id: id, shopId });
  if (!product) throw new AppError("Product not found", 404);
  Object.assign(product, data);
  await product.save();
  return product;
};

const remove = async (shopId, id) => {
  await runInTransaction(async (session) => {
    const product = await Product.findOne({ _id: id, shopId }).session(session);
    if (!product) throw new AppError("Product not found", 404);
    if (await Transaction.exists({ shopId, "items.productId": id }).session(session)) {
      throw new AppError("Product has transaction history and cannot be deleted", 409);
    }
    await product.deleteOne({ session });
  });
};

module.exports = { list, getById, create, update, remove };
