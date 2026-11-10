const mongoose = require("mongoose");

const voiceActionSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: false,
    },
    intent: {
      type: String,
      enum: ["CREATE_SALE", "RECORD_PAYMENT"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "CONFIRMED", "CANCELLED", "EXPIRED"],
      default: "PENDING",
    },
    requestData: { type: mongoose.Schema.Types.Mixed, required: true },
    preview: { type: mongoose.Schema.Types.Mixed, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    processingAt: { type: Date },
    confirmedAt: { type: Date },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

voiceActionSchema.index({ shopId: 1, status: 1, createdAt: -1 });
voiceActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.VoiceAction || mongoose.model("VoiceAction", voiceActionSchema);
