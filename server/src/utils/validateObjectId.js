const mongoose = require("mongoose");
const AppError = require("./appError");

const validateObjectId = (parameterName) => (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params[parameterName])) {
    return next(new AppError(`Invalid ${parameterName}`, 400));
  }

  return next();
};

module.exports = validateObjectId;
