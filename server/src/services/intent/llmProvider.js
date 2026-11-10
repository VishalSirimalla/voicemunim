const AppError = require("../../utils/appError");
const { MAX_QUANTITY } = require("../../utils/quantity");

const INTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "STRING",
      enum: [
        "CREATE_SALE",
        "RECORD_PAYMENT",
        "CHECK_STOCK",
        "CHECK_CUSTOMER_BALANCE",
        "SEARCH_PRODUCT",
        "DAILY_SALES_REPORT",
        "LOW_STOCK_REPORT",
        "UNKNOWN_INTENT",
      ],
    },
    customerName: { type: "STRING", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productName: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING" },
        },
        required: ["productName", "quantity", "unit"],
      },
    },
    payment: {
      type: "OBJECT",
      nullable: true,
      properties: {
        type: {
          type: "STRING",
          nullable: true,
          enum: ["CREDIT", "PAID", "PARTIAL"],
        },
        amount: { type: "NUMBER", nullable: true },
        paymentMethod: {
          type: "STRING",
          nullable: true,
          enum: ["CASH", "UPI", "CARD", "OTHER"],
        },
      },
      required: ["type", "amount", "paymentMethod"],
    },
    query: { type: "STRING", nullable: true },
  },
  required: ["intent", "customerName", "items", "payment", "query"],
};

const SYSTEM_INSTRUCTION =
  "Extract structured business intent from Hindi, Hinglish, English, or other supported Indian-language transcription. " +
  "Return only the requested JSON schema. Supported operations: CREATE_SALE, RECORD_PAYMENT, CHECK_STOCK, " +
  "CHECK_CUSTOMER_BALANCE, SEARCH_PRODUCT, DAILY_SALES_REPORT, LOW_STOCK_REPORT, and UNKNOWN_INTENT. " +
  "A named customer buying goods from this shop is CREATE_SALE; extract the customer's spoken name and each product, quantity, and unit. " +
  "Example: 'आज रमेश ने दुकान से दो किलो चीनी और एक पैकेट नमक खरीदा' means customer Ramesh, " +
  "a sale of 2 kg sugar and 1 packet salt. Use common canonical English product/unit names when translating Hindi terms " +
  "(चीनी -> sugar, नमक -> salt, किलो -> kg, पैकेट -> packet); never guess a brand or invent a product. " +
  "If payment status or method is not stated, set payment.type and payment.paymentMethod to null; do not assume paid, cash, or credit. " +
  "For a partial payment, set the explicitly stated amount and method only. A shop buying stock from a supplier, expenses, " +
  "or another unsupported operation must be UNKNOWN_INTENT, not a customer sale. Never invent prices, stock, balances, or totals. " +
  "Product prices and balances are authoritative only in the database. If essential information is missing, use null or UNKNOWN_INTENT.";

const invalidIntentError = () =>
  new AppError("Gemini returned an invalid intent structure. Please retry or rephrase.", 502, {
    code: "GEMINI_INVALID_INTENT",
    expose: true,
  });

const extractJsonContent = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new AppError("Gemini returned an unreadable response. Please retry.", 502, {
      code: "GEMINI_INVALID_RESPONSE",
      expose: true,
    });
  }
  const content = parts
    .map((part) => part?.text)
    .filter((text) => typeof text === "string")
    .join("")
    .trim();
  if (!content) {
    throw new AppError("Gemini returned an empty response. Please rephrase.", 502, {
      code: "GEMINI_EMPTY_RESPONSE",
      expose: true,
    });
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new AppError("Gemini returned malformed JSON. Please retry or rephrase.", 502, {
      code: "GEMINI_MALFORMED_JSON",
      expose: true,
    });
  }
};

const extractIntent = async (transcript) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!apiKey) {
    throw new AppError("Gemini intent extraction is not configured.", 503, {
      code: "GEMINI_NOT_CONFIGURED",
      expose: true,
    });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new AppError("Configured Gemini model name is invalid.", 503, {
      code: "GEMINI_INVALID_MODEL",
      expose: true,
    });
  }
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  );

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [{ role: "user", parts: [{ text: transcript }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: INTENT_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AppError("Gemini request timed out. Please try again.", 504, {
        code: "GEMINI_TIMEOUT",
        expose: true,
        cause: error,
      });
    }
    throw new AppError("Gemini is temporarily unavailable. Please try again.", 502, {
      code: "GEMINI_NETWORK_ERROR",
      expose: true,
      cause: error,
    });
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError("Gemini is rate-limited. Please try again shortly.", 503, {
        code: "GEMINI_RATE_LIMITED",
        expose: true,
        providerStatus: response.status,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        "Gemini rejected the configured credentials or project access. Check GEMINI_API_KEY and API access.",
        503,
        {
          code: "GEMINI_AUTH_ERROR",
          expose: true,
          providerStatus: response.status,
        }
      );
    }
    if (response.status >= 500) {
      throw new AppError("Gemini is temporarily unavailable. Please try again.", 502, {
        code: "GEMINI_UPSTREAM_ERROR",
        expose: true,
        providerStatus: response.status,
      });
    }
    throw new AppError(
      "Gemini rejected the request. Check the configured model and request format.",
      502,
      {
        code: "GEMINI_REQUEST_REJECTED",
        expose: true,
        providerStatus: response.status,
      }
    );
  }
  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    throw new AppError("Gemini returned an unreadable response. Please retry.", 502, {
      code: "GEMINI_INVALID_RESPONSE",
      expose: true,
    });
  }
  const result = extractJsonContent(responseBody);
  return validateIntent(result);
};

const validateIntent = (intent) => {
  const intents = new Set([
    "CREATE_SALE",
    "RECORD_PAYMENT",
    "CHECK_STOCK",
    "CHECK_CUSTOMER_BALANCE",
    "SEARCH_PRODUCT",
    "DAILY_SALES_REPORT",
    "LOW_STOCK_REPORT",
    "UNKNOWN_INTENT",
  ]);
  if (!intent || typeof intent !== "object" || !intents.has(intent.intent)) {
    throw invalidIntentError();
  }
  if (
    intent.customerName !== null &&
    intent.customerName !== undefined &&
    (typeof intent.customerName !== "string" || intent.customerName.length > 120)
  ) {
    throw invalidIntentError();
  }
  if (!Array.isArray(intent.items)) {
    throw invalidIntentError();
  }
  if (intent.items.length > 50) {
    throw invalidIntentError();
  }
  for (const item of intent.items) {
    if (
      !item ||
      typeof item.productName !== "string" ||
      !item.productName.trim() ||
      item.productName.length > 120 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > MAX_QUANTITY ||
      !Number.isSafeInteger(Math.round(item.quantity * 1000)) ||
      Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-8 ||
      typeof item.unit !== "string" ||
      item.unit.length > 32
    ) {
      throw invalidIntentError();
    }
  }
  if (intent.payment !== null && intent.payment !== undefined) {
    const paymentTypes = new Set(["CREDIT", "PAID", "PARTIAL"]);
    const methods = new Set(["CASH", "UPI", "CARD", "OTHER"]);
    if (
      typeof intent.payment !== "object" ||
      Array.isArray(intent.payment) ||
      (intent.payment.type != null && !paymentTypes.has(intent.payment.type)) ||
      (intent.payment.paymentMethod != null &&
        !methods.has(intent.payment.paymentMethod)) ||
      (intent.payment.amount != null &&
        (!Number.isFinite(intent.payment.amount) ||
          intent.payment.amount < 0 ||
          Math.abs(intent.payment.amount * 100 - Math.round(intent.payment.amount * 100)) >
            1e-8))
    ) {
      throw invalidIntentError();
    }
  }
  if (intent.query !== null && intent.query !== undefined &&
      (typeof intent.query !== "string" || intent.query.length > 120)) {
    throw invalidIntentError();
  }
  return {
    intent: intent.intent,
    customerName: intent.customerName?.trim() || null,
    items: intent.items.map(({ productName, quantity, unit }) => ({
      productName: productName.trim(),
      quantity,
      unit: unit.trim(),
    })),
    payment: intent.payment || null,
    query: typeof intent.query === "string" ? intent.query.trim() : null,
    requiresConfirmation: ["CREATE_SALE", "RECORD_PAYMENT"].includes(intent.intent),
  };
};

module.exports = { extractIntent, validateIntent };
