# Voice workflow and providers

## Request flow

1. An authenticated client uploads an audio file to `/api/v1/voice/process`, or
   obtains a transcript from `/voice/transcribe` and submits it to
   `/voice/interpret`.
2. The Prisma adapter validates file size, declared audio type and file
   signature, then requests transcription using a supported language code.
3. The configured structured-output LLM extracts an intent and spoken entities.
   Its response is parsed and validated; product names, customer names,
   quantities, payment amounts, and operation types are not trusted blindly.
   The Gemini prompt covers Hindi, Hinglish, and English and maps common Hindi
   product/unit terms to canonical names. Unstated payment status and methods
   remain unknown and trigger clarification. Expenses and supplier stock
   purchases are not supported by the current intent schema.
4. Product/customer names are resolved only within the authenticated shop.
   Product prices, current stock, and outstanding balances are read from
   MongoDB. Ambiguous or unknown entities require clarification.
5. Read-only intents return data. Sale/payment intents create a ten-minute
   pending action and preview; no ledger or inventory mutation occurs at this
   stage.
6. The user must explicitly call `/voice/confirm`. Immediately before mutation,
   the API checks the current stock, product prices, and customer balance. A
   changed preview returns `409` and requires another confirmation.
7. Sale/payment execution reuses the idempotent transaction services. Repeated
   confirmation returns the existing transaction. Pending actions can be
   cancelled, expire automatically, and are isolated by shop.
8. The client may send a response string to `/voice/speak` for speech synthesis.

## Provider configuration

- Gnani Prisma v2.5 STT: `GNANI_API_KEY_ID`, optional `GNANI_STT_LANGUAGE`
  (defaults to `hi-IN`). The adapter uses the documented [Prisma REST
  endpoint](https://docs.gnani.ai/api/STT/speech-to-text.md), multipart fields
  `audio_file`, `language_code`, and `format`, plus `X-API-Key-ID`
  authentication. Audio is limited to 10 MB by this application; the provider
  documents a 30-second clip limit.
- Gnani Timbre v2.5 TTS: the same `GNANI_API_KEY_ID`, optional
  `GNANI_TTS_LANGUAGE`, `GNANI_TTS_VOICE`, and `GNANI_TTS_CONTAINER`.
- The Timbre adapter follows the documented [TTS inference
  endpoint](https://docs.gnani.ai/api/TTS/tts-inference.md), including the JSON
  request and binary audio response.
- Intent extraction: configure `GEMINI_API_KEY`; `GEMINI_MODEL` defaults to
  `gemini-2.5-flash`. The adapter uses Google's documented
  [generateContent REST API](https://ai.google.dev/api/generate-content), the
  `x-goog-api-key` header, and [structured JSON
  output](https://ai.google.dev/gemini-api/docs/structured-output). No API is
  assumed for optional Evon v3.3; its official inference contract is not
  configured here.

Provider errors are logged with a request ID and sanitized diagnostic details;
client responses include safe configuration, timeout, rate-limit, and upstream
failure messages. Provider response bodies, credentials, and request contents
are not logged. The Gemini request/response contract, as well as Gnani request
construction and error handling, is tested with mocked HTTP responses. These
tests do not establish live provider access or verify account permissions. Live
Gemini and Gnani calls require valid credentials and are not part of automated
test validation.
