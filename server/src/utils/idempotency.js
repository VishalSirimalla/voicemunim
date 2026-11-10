const crypto = require("node:crypto");
const AppError = require("./appError");
const Transaction = require("../models/Transaction");
const runInTransaction = require("./transaction");

const getIdempotencyKey = (req) => {
  const key = req.get("Idempotency-Key");
  if (!key || key.length > 128 || !/^[\w.-]+$/.test(key)) {
    throw new AppError("A valid Idempotency-Key header is required", 400);
  }
  return key;
};

const fingerprint = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const findReplay = async (shopId, key, requestFingerprint, session) => {
  const existing = await Transaction.findOne({ shopId, idempotencyKey: key }).session(session);
  if (!existing) return null;

  if (existing.requestFingerprint !== requestFingerprint) {
    throw new AppError("Idempotency-Key was already used with a different request", 409);
  }

  return existing;
};

const runIdempotentTransaction = async (shopId, key, requestFingerprint, operation) => {
  try {
    return await runInTransaction(async (session) => {
      const replay = await findReplay(shopId, key, requestFingerprint, session);
      if (replay) return { transaction: replay, replay: true };

      const transaction = await operation(session);
      return { transaction, replay: false };
    });
  } catch (error) {
    if (error.code !== 11000 || !error.keyPattern?.idempotencyKey) throw error;

    const existing = await Transaction.findOne({ shopId, idempotencyKey: key });
    if (!existing) throw error;
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new AppError("Idempotency-Key was already used with a different request", 409);
    }

    return { transaction: existing, replay: true };
  }
};

module.exports = {
  getIdempotencyKey,
  fingerprint,
  findReplay,
  runIdempotentTransaction,
};
