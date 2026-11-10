const sanitizeLogValue = (value) =>
  String(value || "")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(x-api-key-id\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/\b(api[_ -]?key|token|password)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]");

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || "Internal server error";

  if (error.code === 11000) {
    statusCode = 409;
    message = "A record with the provided unique value already exists";
  } else if (error.name === "ValidationError" || error.name === "CastError") {
    statusCode = 400;
    message = error.message;
  } else if (error.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  if (statusCode >= 500) {
    const logEntry = {
      level: "error",
      event: "request_failed",
      requestId: req.requestId || "unavailable",
      method: req.method,
      path: req.path,
      statusCode,
      name: error.name || "Error",
      code: error.code,
      providerStatus: error.providerStatus,
      message: sanitizeLogValue(error.message || "Unknown error"),
      causeName: error.cause?.name,
      causeCode: error.cause?.code,
      causeMessage: error.cause?.message
        ? sanitizeLogValue(error.cause.message)
        : undefined,
      stack: sanitizeLogValue(error.stack || ""),
    };
    console.error(JSON.stringify(logEntry));
    if (!error.expose) message = "Internal server error";
  }

  return res.status(statusCode).json({
    success: false,
    error: { message },
  });
};

module.exports = errorHandler;
