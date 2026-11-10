const mongoose = require("mongoose");
const { MAX_QUANTITY } = require("../utils/quantity");

const isValidStockQuantity = (value) =>
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_QUANTITY &&
  Number.isSafeInteger(Math.round(value * 1000)) &&
  Math.abs(value * 1000 - Math.round(value * 1000)) <= 1e-8;

const productSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: false,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameNormalized: { type: String, required: true, select: false },
    category: { type: String, trim: true, maxlength: 80, default: "" },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          Number.isSafeInteger(Math.round(value * 100)) &&
          Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8,
        message: "price must be a non-negative amount with at most two decimal places",
      },
    },
    unit: { type: String, required: true, trim: true, maxlength: 32 },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: { validator: isValidStockQuantity, message: "stock must be a non-negative quantity with at most three decimals" },
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 0,
      validate: { validator: isValidStockQuantity, message: "lowStockThreshold must be a non-negative quantity with at most three decimals" },
    },
  },
  { timestamps: true }
);

productSchema.pre("validate", function normalizeName() {
  if (this.name !== undefined) this.nameNormalized = this.name.trim().toLocaleLowerCase("en-IN");
});

productSchema.index({ shopId: 1, name: 1 });
productSchema.index({ shopId: 1, stock: 1, lowStockThreshold: 1 });

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
