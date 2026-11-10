const Product = require("../../models/Product");
const Transaction = require("../../models/Transaction");
const AppError = require("../../utils/appError");
const { MAX_QUANTITY, toMilliunits } = require("../../utils/quantity");
const { toPaise, fromPaise } = require("../../utils/money");
const { fingerprint, runIdempotentTransaction } = require("../../utils/idempotency");

const changeStock = async (shopId, id, data, idempotencyKey) => {
  const requestFingerprint = fingerprint({ productId: id, ...data });
  const quantityMilliunits = toMilliunits(data.quantity);

  return runIdempotentTransaction(shopId, idempotencyKey, requestFingerprint, async (session) => {
    const product = await Product.findOne({ _id: id, shopId }).session(session);
    if (!product) throw new AppError("Product not found", 404);
    const isStockIn = data.type === "STOCK_IN";
    const direction = isStockIn || data.direction === "ADD" ? 1 : -1;
    const productStockMilliunits = toMilliunits(product.stock || 0, "Current stock", {
      allowZero: true,
    });
    const nextStockMilliunits = productStockMilliunits + direction * quantityMilliunits;
    const nextStock = nextStockMilliunits / 1000;
    if (
      !Number.isFinite(nextStock) ||
      nextStock < 0 ||
      nextStock > MAX_QUANTITY
    ) {
      throw new AppError("Stock adjustment would produce an invalid stock level", 409);
    }

    product.stock = nextStock;
    await product.save({ session });
    const [transaction] = await Transaction.create(
      [
        {
          type: data.type,
          shopId,
          items: [
            {
              productId: product._id,
              quantity: data.quantity,
              unitPrice: fromPaise(toPaise(product.price, "Product price")),
              ...(data.type === "STOCK_ADJUSTMENT" && { adjustmentDirection: data.direction }),
            },
          ],
          totalAmount: 0,
          idempotencyKey,
          requestFingerprint,
        },
      ],
      { session }
    );
    return transaction;
  });
};

module.exports = { changeStock };
