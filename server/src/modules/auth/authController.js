const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const service = require("./authService");

const validateTimezone = (timeZone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new AppError("businessTimezone must be a valid IANA timezone", 400);
  }
};

const validateCredentials = (body, requiredFields, allowedFields) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const unknown = Object.keys(body).find((field) => !allowedFields.includes(field));
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  const missing = requiredFields.find((field) => body[field] === undefined);
  if (missing) throw new AppError(`${missing} is required`, 400);
};

exports.register = asyncHandler(async (req, res) => {
  const allowed = [
    "shopName",
    "ownerName",
    "email",
    "phone",
    "password",
    "businessAddress",
    "preferredLanguage",
    "businessTimezone",
  ];
  validateCredentials(req.body, ["shopName", "ownerName", "email", "phone", "password"], allowed);

  const {
    shopName,
    ownerName,
    email,
    phone,
    password,
    businessAddress,
    preferredLanguage,
    businessTimezone,
  } = req.body;
  if ([shopName, ownerName, email, phone, password].some((value) => typeof value !== "string")) {
    throw new AppError("Registration fields must be strings", 400);
  }
  if (shopName.trim().length === 0 || ownerName.trim().length === 0) {
    throw new AppError("Shop and owner names cannot be empty", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
    throw new AppError("Enter a valid email address", 400);
  }
  if (!/^[+]?[\d\s()-]{7,20}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw new AppError("Enter a valid phone number", 400);
  }
  if (password.length < 10 || password.length > 128) {
    throw new AppError("Password must be between 10 and 128 characters", 400);
  }
  if (businessAddress !== undefined && typeof businessAddress !== "string") {
    throw new AppError("businessAddress must be a string", 400);
  }
  if (preferredLanguage !== undefined && typeof preferredLanguage !== "string") {
    throw new AppError("preferredLanguage must be a string", 400);
  }
  if (businessTimezone !== undefined && typeof businessTimezone !== "string") {
    throw new AppError("businessTimezone must be a string", 400);
  }
  if (businessTimezone !== undefined) validateTimezone(businessTimezone);

  const result = await service.register({
    shopName: shopName.trim(),
    ownerName: ownerName.trim(),
    email,
    phone,
    password,
    businessAddress,
    preferredLanguage,
    businessTimezone,
  });
  res.status(201).json({ success: true, data: result });
});

exports.login = asyncHandler(async (req, res) => {
  validateCredentials(req.body, ["email", "password"], ["email", "password"]);
  if (
    typeof req.body.email !== "string" ||
    typeof req.body.password !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim()) ||
    req.body.email.length > 254 ||
    req.body.password.length > 128
  ) {
    throw new AppError("email and password must be valid strings", 400);
  }
  const result = await service.login(req.body);
  res.json({ success: true, data: result });
});

exports.profile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: service.getProfile(req.shop) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = [
    "shopName",
    "ownerName",
    "email",
    "phone",
    "businessAddress",
    "preferredLanguage",
    "businessTimezone",
  ];
  validateCredentials(req.body, [], allowed);
  if (!Object.keys(req.body).length) throw new AppError("At least one field is required", 400);
  for (const [field, value] of Object.entries(req.body)) {
    if (typeof value !== "string") throw new AppError(`${field} must be a string`, 400);
  }
  if (
    req.body.email !== undefined &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim()) ||
      req.body.email.length > 254)
  ) {
    throw new AppError("Enter a valid email address", 400);
  }
  for (const field of ["shopName", "ownerName"]) {
    if (req.body[field] !== undefined && req.body[field].trim().length === 0) {
      throw new AppError(`${field} cannot be empty`, 400);
    }
  }
  if (
    req.body.phone !== undefined &&
    (!/^[+]?[\d\s()-]{7,20}$/.test(req.body.phone) ||
      req.body.phone.replace(/\D/g, "").length < 7)
  ) {
    throw new AppError("Enter a valid phone number", 400);
  }
  if (req.body.businessTimezone !== undefined) {
    validateTimezone(req.body.businessTimezone);
  }
  const result = await service.updateProfile(req.shop, req.body);
  res.json({ success: true, data: result });
});

exports.changePassword = asyncHandler(async (req, res) => {
  validateCredentials(
    req.body,
    ["currentPassword", "newPassword"],
    ["currentPassword", "newPassword"]
  );
  if (
    typeof req.body.currentPassword !== "string" ||
    req.body.currentPassword.length > 128 ||
    typeof req.body.newPassword !== "string" ||
    req.body.newPassword.length < 10 ||
    req.body.newPassword.length > 128
  ) {
    throw new AppError("New password must be between 10 and 128 characters", 400);
  }
  const result = await service.changePassword(req.shop, req.body);
  res.json({ success: true, data: result });
});

exports.logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { message: "Discard the bearer token to log out; tokens expire automatically" },
  });
});
