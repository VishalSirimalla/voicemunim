class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.expose = options.expose ?? statusCode < 500;
    if (options.code) this.code = options.code;
    if (options.providerStatus) this.providerStatus = options.providerStatus;
  }
}

module.exports = AppError;
