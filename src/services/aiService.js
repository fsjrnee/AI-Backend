const SYSTEM_PROMPT = "You are a helpful assistant. Reply in the same language as the user.";

const PROVIDERS = {
  groq: {
    keyName: "GROQ_API_KEY",
    defaultModel: "openai/gpt-oss-20b",
    modelName: "GROQ_MODEL",
    request: requestGroq,
  },
  openai: {
    keyName: "OPENAI_API_KEY",
    defaultModel: "gpt-5-mini",
    modelName: "OPENAI_MODEL",
    request: requestOpenAI,
  },
  gemini: {
    keyName: "GEMINI_API_KEY",
    defaultModel: "gemini-3.5-flash-lite",
    modelName: "GEMINI_MODEL",
    request: requestGemini,
  },
};

export class AiServiceError extends Error {
  constructor(message, statusCode = 502, code = "AI_REQUEST_FAILED") {
    super(message);
    this.name = "AiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function getAiReply(message, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const providerName = (env.AI_PROVIDER || "groq").trim().toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new AiServiceError(
      `지원하지 않는 AI_PROVIDER입니다: ${providerName}`,
      503,
      "AI_PROVIDER_UNSUPPORTED",
    );
  }

  const apiKey = env[provider.keyName]?.trim();
  if (!apiKey) {
    throw new AiServiceError(
      `${provider.keyName} 환경 변수가 설정되지 않았습니다.`,
      503,
      "AI_NOT_CONFIGURED",
    );
  }

  const model = env[provider.modelName]?.trim() || provider.defaultModel;
  const maxTokens = parsePositiveInteger(options.maxTokens ?? env.AI_MAX_TOKENS, 512);
  const timeoutMs = parsePositiveInteger(env.AI_REQUEST_TIMEOUT_MS, 30_000);
  const systemPrompt = options.systemPrompt || SYSTEM_PROMPT;

  return provider.request({
    apiKey,
    fetchImpl,
    maxTokens,
    message,
    model,
    systemPrompt,
    timeoutMs,
  });
}

async function requestGroq(options) {
  const data = await requestJson(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.message },
        ],
        max_completion_tokens: options.maxTokens,
      }),
    },
    options,
  );

  return requireReply(data.choices?.[0]?.message?.content);
}

async function requestOpenAI(options) {
  const data = await requestJson(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        instructions: options.systemPrompt,
        input: options.message,
        max_output_tokens: options.maxTokens,
        store: false,
      }),
    },
    options,
  );

  const reply = data.output_text
    || data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("");

  return requireReply(reply);
}

async function requestGemini(options) {
  const encodedModel = encodeURIComponent(options.model);
  const data = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: options.message }] }],
        generationConfig: { maxOutputTokens: options.maxTokens },
      }),
    },
    options,
  );

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  return requireReply(reply);
}

async function requestJson(url, requestOptions, { fetchImpl, timeoutMs }) {
  if (typeof fetchImpl !== "function") {
    throw new AiServiceError(
      "이 Node.js 버전에서는 fetch를 사용할 수 없습니다.",
      500,
      "FETCH_UNAVAILABLE",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...requestOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiServiceError(
        `AI API 호출에 실패했습니다. (HTTP ${response.status})`,
        502,
        "AI_UPSTREAM_ERROR",
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new AiServiceError(
        "AI API 응답 시간이 초과되었습니다.",
        504,
        "AI_TIMEOUT",
      );
    }

    throw new AiServiceError(
      "AI API에 연결하지 못했습니다.",
      502,
      "AI_CONNECTION_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function requireReply(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AiServiceError(
      "AI API가 빈 응답을 반환했습니다.",
      502,
      "AI_EMPTY_RESPONSE",
    );
  }

  return value.trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

