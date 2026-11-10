
const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const VoiceAction = require("../models/VoiceAction");

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not configured");
    }

    connectionPromise = mongoose
      .connect(mongoUri)
      .then(async () => {
        await Promise.all([
          Shop.init(),
          Product.init(),
          Customer.init(),
          Transaction.init(),
          VoiceAction.init(),
        ]);

        console.log("MongoDB connected successfully!");
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
};

module.exports = connectDB;
