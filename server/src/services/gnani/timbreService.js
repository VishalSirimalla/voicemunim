const AppError = require("../../utils/appError");

const ENDPOINT = "https://api.vachana.ai/api/v1/tts/inference";
const LANGUAGES = new Set([
  "auto",
  "hi-IN",
  "en-IN",
  "ta-IN",
  "te-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "pa-IN",
  "bn-IN",
  "gu-IN",
  "hi-en",
]);
const CONTAINERS = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

const synthesize = async ({ text, language, voice, container }) => {
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 5000) {
    throw new AppError("text must contain between 1 and 5000 characters", 400);
  }
  const selectedLanguage = language || process.env.GNANI_TTS_LANGUAGE || "hi-IN";
  if (!LANGUAGES.has(selectedLanguage)) throw new AppError("Unsupported Timbre language", 400);
  const selectedVoice = voice || process.env.GNANI_TTS_VOICE || "Nalini";
  if (typeof selectedVoice !== "string" || selectedVoice.trim().length === 0 || selectedVoice.length > 100) {
    throw new AppError("voice must contain between 1 and 100 characters", 400);
  }
  const selectedContainer = container || process.env.GNANI_TTS_CONTAINER || "wav";
  if (!CONTAINERS[selectedContainer]) {
    throw new AppError("TTS container must be wav, mp3, or ogg", 400);
  }
  const apiKeyId = process.env.GNANI_API_KEY_ID;
  if (!apiKeyId) {
    throw new AppError("Gnani speech synthesis is not configured.", 503, {
      code: "GNANI_TTS_NOT_CONFIGURED",
      expose: true,
    });
  }

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-Key-ID": apiKeyId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        voice: selectedVoice,
        model: "timbre-v2.5",
        language: selectedLanguage,
        audio_config: {
          sample_rate: 24000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: selectedContainer,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AppError("Speech synthesis timed out. Please try again.", 504, {
        code: "GNANI_TTS_TIMEOUT",
        expose: true,
        cause: error,
      });
    }
    throw new AppError("Speech synthesis provider is temporarily unavailable.", 502, {
      code: "GNANI_TTS_NETWORK_ERROR",
      expose: true,
      cause: error,
    });
  }
  if (!response.ok) {
    throw new AppError(
      response.status === 401 || response.status === 403
        ? "Gnani rejected the configured credentials or account access."
        : "Speech synthesis provider rejected the request.",
      response.status === 429 ? 503 : 502,
      {
        code:
          response.status === 429
            ? "GNANI_TTS_RATE_LIMITED"
            : response.status === 401 || response.status === 403
              ? "GNANI_TTS_AUTH_ERROR"
              : "GNANI_TTS_UPSTREAM_ERROR",
        expose: true,
        providerStatus: response.status,
      }
    );
  }

  let audio;
  try {
    audio = Buffer.from(await response.arrayBuffer());
  } catch {
    throw new AppError("Speech synthesis provider returned unreadable audio.", 502, {
      code: "GNANI_TTS_INVALID_AUDIO",
      expose: true,
    });
  }
  if (audio.length === 0 || audio.length > 15 * 1024 * 1024) {
    throw new AppError("Speech synthesis provider returned invalid audio.", 502, {
      code: "GNANI_TTS_INVALID_AUDIO",
      expose: true,
    });
  }
  return { audio, contentType: CONTAINERS[selectedContainer], container: selectedContainer };
};

module.exports = { ENDPOINT, LANGUAGES, synthesize };
