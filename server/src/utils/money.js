const AppError = require("./appError");

const toPaise = (amount, field = "amount", { allowZero = true } = {}) => {
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new AppError(
      `${field} must be a ${allowZero ? "non-negative" : "positive"} number`,
      400
    );
  }

  const paise = Math.round(amount * 100);
  if (
    !Number.isSafeInteger(paise) ||
    Math.abs(amount * 100 - paise) > 1e-8
  ) {
    throw new AppError(`${field} must use at most two decimal places`, 400);
  }

  return paise;
};

const fromPaise = (paise) => Number((paise / 100).toFixed(2));

module.exports = { toPaise, fromPaise };
