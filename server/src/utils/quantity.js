const AppError = require("./appError");

const MAX_QUANTITY = 100000;
const QUANTITY_SCALE = 1000;

const toMilliunits = (quantity, field = "quantity", { allowZero = false } = {}) => {
  if (
    !Number.isFinite(quantity) ||
    (allowZero ? quantity < 0 : quantity <= 0) ||
    quantity > MAX_QUANTITY
  ) {
    throw new AppError(
      `${field} must be ${allowZero ? "non-negative" : "greater than zero"} and at most ${MAX_QUANTITY}`,
      400
    );
  }

  const milliunits = Math.round(quantity * QUANTITY_SCALE);
  if (
    !Number.isSafeInteger(milliunits) ||
    Math.abs(quantity * QUANTITY_SCALE - milliunits) > 1e-8
  ) {
    throw new AppError(`${field} must use at most three decimal places`, 400);
  }
  if (quantity > 0 && milliunits === 0) {
    throw new AppError(`${field} must be at least 0.001`, 400);
  }

  return milliunits;
};

module.exports = { MAX_QUANTITY, QUANTITY_SCALE, toMilliunits };
