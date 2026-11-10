const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
process.env.CORS_ORIGINS = "https://shop.example";
process.env.JWT_SECRET = "test-only-signing-secret-that-is-at-least-32-characters";
const app = require("../src/app");
const Customer = require("../src/models/Customer");
const Product = require("../src/models/Product");
const Transaction = require("../src/models/Transaction");
const { resolveCustomer } = require("../src/modules/voice/voiceService");
const { extractIntent } = require("../src/services/intent/llmProvider");
const errorHandler = require("../src/middleware/errorHandler");
const prisma = require("../src/services/gnani/prismaService");
const timbre = require("../src/services/gnani/timbreService");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint remains available", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
  assert.equal((await response.json()).success, true);
});

test("protected API routes require a bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});

test("voice interpretation requires a bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/v1/voice/interpret`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcription: "आज रमेश ने दो किलो चीनी खरीदी" }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.message, "Authentication required");
});

test("voice customer matching transliterates Hindi names to existing English names", async () => {
  const originalFind = Customer.find;
  const existingCustomer = { id: "customer-id", name: "Ramesh", phone: "1234567890" };
  let exactQuery;
  Customer.find = (query) => {
    if (query.nameNormalized) exactQuery = query;
    return {
      select() {
        return this;
      },
      async limit() {
        return query.nameNormalized && query.nameNormalized.$in.includes("ramesh")
          ? [existingCustomer]
          : [];
      },
    };
  };

  try {
    const result = await resolveCustomer("shop-id", "  रमेश  ");
    assert.deepEqual(result, { customer: existingCustomer });
    assert.ok(exactQuery.nameNormalized.$in.includes("रमेश"));
    assert.ok(exactQuery.nameNormalized.$in.includes("ramesh"));

    await resolveCustomer("shop-id", "Rama");
    assert.deepEqual(exactQuery.nameNormalized.$in, ["rama"]);
  } finally {
    Customer.find = originalFind;
  }
});

test("protected API routes reject malformed bearer tokens without database access", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products`, {
    headers: { authorization: "Bearer not-a-valid-token" },
  });
  assert.equal(response.status, 401);
});

test("registration validates required fields before database access", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /shopName is required/);
});

test("resource routes require authentication before looking up identifiers", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products/not-an-id`);
  assert.equal(response.status, 401);
});

test("Mongoose models enforce monetary precision", async () => {
  const shopId = "507f1f77bcf86cd799439011";
  const product = new Product({ shopId, name: "Rice", price: 1.001, unit: "kg" });
  await assert.rejects(product.validate(), /price must be a non-negative amount/);

  const transaction = new Transaction({
    shopId,
    type: "SALE",
    items: [{ productId: "507f1f77bcf86cd799439011", quantity: 1, unitPrice: 1.001 }],
    totalAmount: 1,
  });
  await assert.rejects(transaction.validate(), /unitPrice must use at most two decimals/);
});

test("intent extraction sends Gemini generateContent JSON request and validates its response", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  let capturedUrl;
  let capturedOptions;
  process.env.GEMINI_API_KEY = "test-key-not-sent-over-network";
  process.env.GEMINI_MODEL = "gemini-test-flash";
  global.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    intent: "CREATE_SALE",
                    customerName: "Ramesh",
                    items: [{ productName: "sugar", quantity: 2, unit: "kg" }],
                    payment: { type: null, amount: null, paymentMethod: null },
                    query: null,
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  try {
    const result = await extractIntent("आज रमेश ने दो किलो चीनी खरीदी");
    assert.match(
      capturedUrl,
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test-flash:generateContent$/
    );
    assert.equal(capturedOptions.method, "POST");
    assert.equal(capturedOptions.headers["x-goog-api-key"], "test-key-not-sent-over-network");
    const requestBody = JSON.parse(capturedOptions.body);
    assert.equal(requestBody.contents[0].parts[0].text, "आज रमेश ने दो किलो चीनी खरीदी");
    assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
    assert.equal(requestBody.generationConfig.responseSchema.type, "OBJECT");
    assert.match(requestBody.systemInstruction.parts[0].text, /Hindi, Hinglish, English/);
    assert.equal(result.intent, "CREATE_SALE");
    assert.deepEqual(result.items[0], { productName: "sugar", quantity: 2, unit: "kg" });
    assert.equal(result.payment.type, null);
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test("intent extraction uses the supported default Gemini model and documented URL path", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  let capturedUrl;
  process.env.GEMINI_API_KEY = "test-key-not-sent-over-network";
  delete process.env.GEMINI_MODEL;
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    intent: "UNKNOWN_INTENT",
                    customerName: null,
                    items: [],
                    payment: null,
                    query: null,
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  try {
    await extractIntent("test transcript");
    assert.equal(
      capturedUrl,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
    );
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test("intent extraction sends Hindi, English, and mixed-language transcripts through one schema", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const transcripts = [
    "आज रमेश ने दुकान से दो किलो चीनी और एक पैकेट नमक खरीदा",
    "Ramesh bought 2 kg sugar and 1 packet salt from the shop",
    "Ramesh ne 2 kilo sugar aur ek packet salt liya",
  ];
  const intents = [
    {
      intent: "CREATE_SALE",
      customerName: "Ramesh",
      items: [
        { productName: "sugar", quantity: 2, unit: "kg" },
        { productName: "salt", quantity: 1, unit: "packet" },
      ],
      payment: { type: null, amount: null, paymentMethod: null },
      query: null,
    },
    {
      intent: "CREATE_SALE",
      customerName: "Ramesh",
      items: [
        { productName: "sugar", quantity: 2, unit: "kg" },
        { productName: "salt", quantity: 1, unit: "packet" },
      ],
      payment: { type: "PAID", amount: null, paymentMethod: "CASH" },
      query: null,
    },
    {
      intent: "CREATE_SALE",
      customerName: "Ramesh",
      items: [
        { productName: "sugar", quantity: 2, unit: "kg" },
        { productName: "salt", quantity: 1, unit: "packet" },
      ],
      payment: { type: "CREDIT", amount: null, paymentMethod: null },
      query: null,
    },
  ];
  let index = 0;
  process.env.GEMINI_API_KEY = "mock-key";
  process.env.GEMINI_MODEL = "gemini-test-flash";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(intents[index++]) }] } }],
    }),
  });

  try {
    for (const transcript of transcripts) {
      const result = await extractIntent(transcript);
      assert.equal(result.intent, "CREATE_SALE");
      assert.equal(result.customerName, "Ramesh");
      assert.deepEqual(
        result.items.map(({ productName, quantity, unit }) => ({ productName, quantity, unit })),
        [
          { productName: "sugar", quantity: 2, unit: "kg" },
          { productName: "salt", quantity: 1, unit: "packet" },
        ]
      );
    }
    assert.equal(index, transcripts.length);
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test("Gemini configuration and provider failures return classified safe errors", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(extractIntent("test"), {
      code: "GEMINI_NOT_CONFIGURED",
      statusCode: 503,
    });

    process.env.GEMINI_API_KEY = "mock-key";
    process.env.GEMINI_MODEL = "gemini-test-flash";
    for (const [status, code, expectedStatus] of [
      [429, "GEMINI_RATE_LIMITED", 503],
      [500, "GEMINI_UPSTREAM_ERROR", 502],
    ]) {
      global.fetch = async () => ({ ok: false, status });
      await assert.rejects(extractIntent("test"), { code, statusCode: expectedStatus });
    }

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{not json" }] } }],
      }),
    });
    await assert.rejects(extractIntent("test"), {
      code: "GEMINI_MALFORMED_JSON",
      statusCode: 502,
    });

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ intent: "UNSUPPORTED" }) }] } }],
      }),
    });
    await assert.rejects(extractIntent("test"), {
      code: "GEMINI_INVALID_INTENT",
      statusCode: 502,
    });

    global.fetch = async () => {
      const error = new Error("timeout");
      error.name = "TimeoutError";
      throw error;
    };
    await assert.rejects(extractIntent("test"), {
      code: "GEMINI_TIMEOUT",
      statusCode: 504,
    });

    global.fetch = async () => {
      const error = new Error("connection reset");
      error.code = "ECONNRESET";
      throw error;
    };
    let networkError;
    try {
      await extractIntent("test");
    } catch (error) {
      networkError = error;
    }
    assert.equal(networkError.code, "GEMINI_NETWORK_ERROR");
    assert.equal(networkError.cause.code, "ECONNRESET");
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
});

test("error handler logs sanitized diagnostics and returns safe 5xx responses", () => {
  const originalConsoleError = console.error;
  let capturedLog = "";
  let responseStatus;
  let responseBody;
  console.error = (message) => {
    capturedLog = message;
  };
  const requestError = new Error(
    "Authorization: Bearer fake-jwt API_KEY=fake-key token=fake-token"
  );
  requestError.cause = new Error("API_KEY=fake-cause-key");
  try {
    errorHandler(
      requestError,
      { requestId: "request-id", method: "POST", path: "/api/v1/voice/interpret" },
      {
        headersSent: false,
        status(status) {
          responseStatus = status;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      },
      (error) => {
        throw error;
      }
    );
    assert.equal(responseStatus, 500);
    assert.deepEqual(responseBody, {
      success: false,
      error: { message: "Internal server error" },
    });
    assert.match(capturedLog, /request-id/);
    assert.match(capturedLog, /voice\/interpret/);
    assert.doesNotMatch(capturedLog, /fake-jwt|fake-key|fake-token/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("Gnani STT and TTS adapters send configured requests and validate mocked responses", async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = process.env.GNANI_API_KEY_ID;
  const originalSttLanguage = process.env.GNANI_STT_LANGUAGE;
  const calls = [];
  process.env.GNANI_API_KEY_ID = "mock-key-id";
  process.env.GNANI_STT_LANGUAGE = "hi-IN";
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          transcript: "आज दुकान खुली है",
          model: "prisma-v2.5",
        }),
      };
    }
    return {
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    };
  };

  try {
    const transcription = await prisma.transcribe(
      { mimetype: "audio/wav", buffer: Buffer.from("RIFF1234WAVE") },
      "hi-IN"
    );
    assert.equal(transcription.transcript, "आज दुकान खुली है");
    assert.equal(calls[0].url, prisma.ENDPOINT);
    assert.equal(calls[0].options.headers["X-API-Key-ID"], "mock-key-id");
    assert.equal(calls[0].options.body.get("language_code"), "hi-IN");
    assert.equal(calls[0].options.body.get("format"), "verbatim");
    assert.equal(calls[0].options.body.get("audio_file").type, "audio/wav");

    const audio = await timbre.synthesize({ text: "नमस्ते" });
    assert.deepEqual(audio.audio, Buffer.from([1, 2, 3]));
    assert.equal(audio.contentType, "audio/wav");
    assert.equal(calls[1].url, timbre.ENDPOINT);
    assert.equal(calls[1].options.headers["X-API-Key-ID"], "mock-key-id");
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      text: "नमस्ते",
      voice: "Nalini",
      model: "timbre-v2.5",
      language: "hi-IN",
      audio_config: {
        sample_rate: 24000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    });

    global.fetch = async () => ({
      ok: true,
      json: async () => ({ success: true, transcript: "" }),
    });
    const emptyTranscription = await prisma.transcribe(
      { mimetype: "audio/wav", buffer: Buffer.from("RIFF1234WAVE") },
      "hi-IN"
    );
    assert.equal(emptyTranscription.transcript, "");
  } finally {
    global.fetch = originalFetch;
    if (originalApiKeyId === undefined) delete process.env.GNANI_API_KEY_ID;
    else process.env.GNANI_API_KEY_ID = originalApiKeyId;
    if (originalSttLanguage === undefined) delete process.env.GNANI_STT_LANGUAGE;
    else process.env.GNANI_STT_LANGUAGE = originalSttLanguage;
  }
});

test("Gnani STT and TTS failures are classified without exposing provider bodies", async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = process.env.GNANI_API_KEY_ID;
  process.env.GNANI_API_KEY_ID = "mock-key-id";
  global.fetch = async () => ({ ok: false, status: 429 });
  try {
    await assert.rejects(
      prisma.transcribe(
        { mimetype: "audio/wav", buffer: Buffer.from("RIFF1234WAVE") },
        "hi-IN"
      ),
      { code: "GNANI_STT_RATE_LIMITED", statusCode: 503 }
    );
    await assert.rejects(
      timbre.synthesize({ text: "नमस्ते" }),
      { code: "GNANI_TTS_RATE_LIMITED", statusCode: 503 }
    );
  } finally {
    global.fetch = originalFetch;
    if (originalApiKeyId === undefined) delete process.env.GNANI_API_KEY_ID;
    else process.env.GNANI_API_KEY_ID = originalApiKeyId;
  }
});

test("CORS allows configured origins and rejects unconfigured origins", async () => {
  const allowed = await fetch(`${baseUrl}/`, {
    headers: { Origin: "https://shop.example" },
  });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://shop.example");

  const preflight = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization,idempotency-key",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.match(preflight.headers.get("access-control-allow-methods"), /POST/);
  assert.match(preflight.headers.get("access-control-allow-methods"), /OPTIONS/);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Content-Type/i);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/i);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Idempotency-Key/i);

  const rejected = await fetch(`${baseUrl}/`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error.message, "Origin is not allowed by CORS");
});

test("unknown API routes use the standard not-found response", async () => {
  const response = await fetch(`${baseUrl}/api/v1/unknown`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, "Route not found");
});
