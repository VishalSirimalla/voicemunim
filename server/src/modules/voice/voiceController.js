const multer = require("multer");
const asyncHandler = require("../../utils/asyncHandler");
const AppError = require("../../utils/appError");
const prisma = require("../../services/gnani/prismaService");
const timbre = require("../../services/gnani/timbreService");
const service = require("./voiceService");

const supportedMimeTypes = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: prisma.MAX_FILE_BYTES, files: 1, fields: 4 },
  fileFilter(req, file, callback) {
    if (!supportedMimeTypes.has(file.mimetype)) {
      return callback(new AppError("Unsupported audio format", 415));
    }
    return callback(null, true);
  },
});

exports.upload = upload.single("audio");

exports.transcribe = asyncHandler(async (req, res) => {
  const result = await prisma.transcribe(req.file, req.body?.languageCode);
  res.json({ success: true, data: result });
});

exports.process = asyncHandler(async (req, res) => {
  const transcription = await prisma.transcribe(req.file, req.body?.languageCode);
  if (!transcription.transcript.trim()) {
    throw new AppError("No speech was detected in the uploaded audio.", 422);
  }
  const result = await service.processTranscript(
    req.auth.shopId,
    req.shop,
    transcription.transcript
  );
  res.json({ success: true, data: { ...result, transcription } });
});

exports.interpret = asyncHandler(async (req, res) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((field) => field !== "transcription")
  ) {
    throw new AppError("Body must contain only transcription", 400);
  }
  const result = await service.processTranscript(
    req.auth.shopId,
    req.shop,
    req.body.transcription
  );
  res.json({ success: true, data: result });
});

exports.confirm = asyncHandler(async (req, res) => {
  const actionId = validateActionIdBody(req.body);
  const result = await service.confirm(req.auth.shopId, actionId);
  if (result.reconfirmationRequired) {
    return res.status(409).json({
      success: false,
      error: { message: result.message },
      data: result,
    });
  }
  return res.json({ success: true, data: result.transaction });
});

exports.cancel = asyncHandler(async (req, res) => {
  const actionId = validateActionIdBody(req.body);
  const result = await service.cancel(req.auth.shopId, actionId);
  res.json({ success: true, data: result });
});

function validateActionIdBody(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((field) => field !== "actionId")
  ) {
    throw new AppError("Body must contain only actionId", 400);
  }
  if (typeof body.actionId !== "string" || !body.actionId) {
    throw new AppError("actionId is required", 400);
  }
  return body.actionId;
}

exports.speak = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Request body must be an object", 400);
  }
  const allowed = ["text", "language", "voice", "container"];
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw new AppError(`Unknown field: ${unknown}`, 400);
  const result = await timbre.synthesize(body);
  res.set("Content-Type", result.contentType);
  res.set("Content-Length", result.audio.length);
  res.set("Content-Disposition", `inline; filename="voice-response.${result.container}"`);
  return res.status(200).send(result.audio);
});
