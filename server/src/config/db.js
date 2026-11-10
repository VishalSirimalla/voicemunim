const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const VoiceAction = require("../models/VoiceAction");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not configured");
    }

    await mongoose.connect(mongoUri);
    await Promise.all([
      Shop.init(),
      Product.init(),
      Customer.init(),
      Transaction.init(),
      VoiceAction.init(),
    ]);

    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error.name);
    process.exit(1);
  }
};

module.exports = connectDB;