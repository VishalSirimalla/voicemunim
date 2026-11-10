const AppError = require("./appError");

const parsePagination = (query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError("page must be positive and limit must be between 1 and 100", 400);
  }

  return { page, limit, skip: (page - 1) * limit };
};

module.exports = parsePagination;
