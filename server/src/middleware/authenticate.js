const jwt = require("jsonwebtoken");
const Shop = require("../models/Shop");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401);
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError("Authentication is not configured", 503);
  }

  let claims;
  try {
    claims = jwt.verify(authorization.slice(7), secret, {
      issuer: "voicemunim-api",
      audience: "voicemunim-client",
    });
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }
  if (!claims || typeof claims !== "object" || !claims.sub) {
    throw new AppError("Invalid access token", 401);
  }

  const shop = await Shop.findById(claims.sub).select("+tokenVersion");
  if (
    !shop ||
    shop.status !== "ACTIVE" ||
    shop.tokenVersion !== claims.tokenVersion
  ) {
    throw new AppError("Invalid or expired access token", 401);
  }
  req.shop = shop;
  req.auth = { shopId: shop._id };
  return next();
});

module.exports = authenticate;
