const AppError = require("../../utils/appError");

const ENDPOINT = "https://api.vachana.ai/stt/v3";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const LANGUAGES = new Set([
  "bn-IN",
  "en-IN",
  "gu-IN",
  "hi-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
]);
const FORMATS = {
  "audio/wav": { extension: "wav", signature: (buffer) => buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE" },
  "audio/x-wav": { extension: "wav", signature: (buffer) => buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE" },
  "audio/mpeg": { extension: "mp3", signature: (buffer) => buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) },
  "audio/mp3": { extension: "mp3", signature: (buffer) => buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) },
  "audio/ogg": { extension: "ogg", signature: (buffer) => buffer.toString("ascii", 0, 4) === "OggS" },
  "audio/flac": { extension: "flac", signature: (buffer) => buffer.toString("ascii", 0, 4) === "fLaC" },
  "audio/aac": { extension: "aac", signature: (buffer) => buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0 },
  "audio/mp4": { extension: "m4a", signature: (buffer) => buffer.toString("ascii", 4, 8) === "ftyp" },
  "audio/x-m4a": { extension: "m4a", signature: (buffer) => buffer.toString("ascii", 4, 8) === "ftyp" },
};

const validateAudioFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new AppError("An audio file is required", 400);
  }
  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new AppError("Audio file exceeds the 10 MB upload limit", 413);
  }
  const format = FORMATS[file.mimetype];
  if (!format) throw new AppError("Unsupported audio format", 415);
  if (!format.signature(file.buffer)) {
    throw new AppError("Audio file content does not match its declared format", 415);
  }
  return format;
};

const transcribe = async (file, languageCode = process.env.GNANI_STT_LANGUAGE || "hi-IN") => {
  const format = validateAudioFile(file);
  if (!LANGUAGES.has(languageCode)) {
    throw new AppError("Unsupported Prisma v2.5 language code", 400);
  }
  const apiKeyId = process.env.GNANI_API_KEY_ID;
  if (!apiKeyId) {
    throw new AppError("Gnani speech recognition is not configured.", 503, {
      code: "GNANI_STT_NOT_CONFIGURED",
      expose: true,
    });
  }

  const form = new FormData();
  form.append(
    "audio_file",
    new Blob([file.buffer], { type: file.mimetype }),
    `recording.${format.extension}`
  );
  form.append("language_code", languageCode);
  form.append("format", "verbatim");

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "X-API-Key-ID": apiKeyId },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AppError("Speech recognition timed out. Please try again.", 504, {
        code: "GNANI_STT_TIMEOUT",
        expose: true,
        cause: error,
      });
    }
    throw new AppError("Speech recognition provider is temporarily unavailable.", 502, {
      code: "GNANI_STT_NETWORK_ERROR",
      expose: true,
      cause: error,
    });
  }
  if (!response.ok) {
    throw new AppError(
      response.status === 401 || response.status === 403
        ? "Gnani rejected the configured credentials or account access."
        : "Speech recognition provider rejected the request.",
      response.status === 429 ? 503 : 502,
      {
        code:
          response.status === 429
            ? "GNANI_STT_RATE_LIMITED"
            : response.status === 401 || response.status === 403
              ? "GNANI_STT_AUTH_ERROR"
              : "GNANI_STT_UPSTREAM_ERROR",
        expose: true,
        providerStatus: response.status,
      }
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new AppError("Speech recognition provider returned an unreadable response.", 502, {
      code: "GNANI_STT_INVALID_RESPONSE",
      expose: true,
    });
  }
  if (
    result.success !== true ||
    typeof result.transcript !== "string" ||
    result.transcript.length > 5000
  ) {
    throw new AppError("Speech recognition did not return a valid response.", 502, {
      code: "GNANI_STT_INVALID_TRANSCRIPT",
      expose: true,
    });
  }
  return {
    transcript: result.transcript,
    model: result.model || "prisma-v2.5",
    requestId: result.request_id,
    processingTime: result.processing_time,
  };
};

module.exports = { ENDPOINT, LANGUAGES, MAX_FILE_BYTES, validateAudioFile, transcribe };
