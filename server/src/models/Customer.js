const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: false,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number"],
    },
    nameNormalized: { type: String, required: true, select: false },
    phoneNormalized: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

customerSchema.pre("validate", function normalizePhone() {
  if (this.name !== undefined) this.nameNormalized = this.name.trim().toLocaleLowerCase("en-IN");
  if (this.phone !== undefined) this.phoneNormalized = this.phone.replace(/\D/g, "");
});

customerSchema.index(
  { shopId: 1, phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      shopId: { $type: "objectId" },
      phoneNormalized: { $type: "string" },
    },
  }
);
customerSchema.index({ shopId: 1, name: 1 });

module.exports = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
