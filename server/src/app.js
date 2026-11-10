const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { randomUUID } = require("node:crypto");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./modules/auth/authRoutes");
const dashboardRoutes = require("./modules/dashboard/dashboardRoutes");
const reportRoutes = require("./modules/reports/reportRoutes");
const voiceRoutes = require("./modules/voice/voiceRoutes");
const productRoutes = require("./modules/products/productRoutes");
const customerRoutes = require("./modules/customers/customerRoutes");
const saleRoutes = require("./modules/sales/saleRoutes");
const paymentRoutes = require("./modules/payments/paymentRoutes");
const AppError = require("./utils/appError");

const app = express();
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...configuredOrigins, "http://localhost:5173"]);

// Middlewares
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(helmet());
app.use(
  cors({
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    optionsSuccessStatus: 204,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new AppError("Origin is not allowed by CORS", 403));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to VoiceMunim API 🚀",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/voice", voiceRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/sales", saleRoutes);
app.use("/api/v1/payments", paymentRoutes);

app.use((req, res, next) => next(new AppError("Route not found", 404)));
app.use(errorHandler);

module.exports = app;