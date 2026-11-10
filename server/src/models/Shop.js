const mongoose = require("mongoose");

const normalizePhone = (value) => value.replace(/\D/g, "");

const shopSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    emailNormalized: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    phoneNormalized: { type: String, required: true, select: false },
    passwordHash: { type: String, required: true, select: false },
    businessAddress: { type: String, trim: true, maxlength: 500, default: "" },
    preferredLanguage: { type: String, trim: true, maxlength: 32, default: "hi-IN" },
    businessTimezone: { type: String, trim: true, maxlength: 64, default: "Asia/Kolkata" },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" },
    tokenVersion: { type: Number, min: 0, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, result) {
        delete result.passwordHash;
        delete result.emailNormalized;
        delete result.phoneNormalized;
        delete result.tokenVersion;
        delete result.__v;
        return result;
      },
    },
  }
);

shopSchema.pre("validate", function normalizeIdentifiers() {
  if (this.email !== undefined) this.emailNormalized = this.email.trim().toLowerCase();
  if (this.phone !== undefined) this.phoneNormalized = normalizePhone(this.phone);
});

shopSchema.index({ emailNormalized: 1 }, { unique: true });
shopSchema.index({ phoneNormalized: 1 }, { unique: true });

shopSchema.methods.toSafeObject = function toSafeObject() {
  const result = this.toObject();
  delete result.passwordHash;
  delete result.emailNormalized;
  delete result.phoneNormalized;
  delete result.tokenVersion;
  delete result.__v;
  return result;
};

module.exports = mongoose.models.Shop || mongoose.model("Shop", shopSchema);
