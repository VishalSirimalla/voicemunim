const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Shop = require("../../models/Shop");
const AppError = require("../../utils/appError");

const PASSWORD_ROUNDS = 12;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError("Authentication is not configured", 503);
  }
  return secret;
};

const validateJwtConfiguration = () => {
  const secret = getJwtSecret();
  try {
    jwt.sign({}, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "12h" });
  } catch {
    throw new AppError("Authentication configuration is invalid", 503);
  }
};

const normalizePhone = (phone) => phone.replace(/\D/g, "");

const issueToken = (shop) =>
  jwt.sign(
    { tokenVersion: shop.tokenVersion },
    getJwtSecret(),
    {
      subject: shop.id,
      expiresIn: process.env.JWT_EXPIRES_IN || "12h",
      issuer: "voicemunim-api",
      audience: "voicemunim-client",
    }
  );

const register = async (data) => {
  validateJwtConfiguration();
  const passwordHash = await bcrypt.hash(data.password, PASSWORD_ROUNDS);
  const shop = await Shop.create({
    shopName: data.shopName,
    ownerName: data.ownerName,
    email: data.email.trim().toLowerCase(),
    emailNormalized: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    phoneNormalized: normalizePhone(data.phone),
    passwordHash,
    businessAddress: data.businessAddress,
    preferredLanguage: data.preferredLanguage,
    businessTimezone: data.businessTimezone,
  });

  return { shop: shop.toSafeObject(), token: issueToken(shop) };
};

const login = async ({ email, password }) => {
  const shop = await Shop.findOne({ emailNormalized: email.trim().toLowerCase() })
    .select("+passwordHash +tokenVersion");
  if (!shop || shop.status !== "ACTIVE" || !(await bcrypt.compare(password, shop.passwordHash))) {
    throw new AppError("Invalid email or password", 401);
  }
  return { shop: shop.toSafeObject(), token: issueToken(shop) };
};

const getProfile = (shop) => shop.toSafeObject();

const updateProfile = async (shop, data) => {
  for (const [field, value] of Object.entries(data)) {
    shop[field] = value;
  }
  await shop.save();
  return shop.toSafeObject();
};

const changePassword = async (shop, { currentPassword, newPassword }) => {
  const current = await Shop.findById(shop._id).select("+passwordHash +tokenVersion");
  if (!current || !(await bcrypt.compare(currentPassword, current.passwordHash))) {
    throw new AppError("Current password is incorrect", 401);
  }
  current.passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
  current.tokenVersion += 1;
  await current.save();
  return { message: "Password changed; other active sessions have been invalidated" };
};

module.exports = { register, login, getProfile, updateProfile, changePassword };
