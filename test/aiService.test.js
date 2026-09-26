import assert from "node:assert/strict";
import test from "node:test";

import { AiServiceError, getAiReply } from "../src/services/aiService.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("키가 없으면 외부 요청 없이 설정 오류를 반환한다", async () => {
  let called = false;

  await assert.rejects(
    getAiReply("안녕", {
      env: { AI_PROVIDER: "groq" },
      fetchImpl: async () => {
        called = true;
      },
    }),
    (error) => error instanceof AiServiceError
      && error.statusCode === 503
      && error.code === "AI_NOT_CONFIGURED",
  );

  assert.equal(called, false);
});

test("Groq 응답을 공통 문자열 형식으로 변환한다", async () => {
  const reply = await getAiReply("안녕", {
    env: { AI_PROVIDER: "groq", GROQ_API_KEY: "test-key" },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
      assert.match(options.headers.Authorization, /^Bearer /);
      return jsonResponse({ choices: [{ message: { content: "안녕하세요!" } }] });
    },
  });

  assert.equal(reply, "안녕하세요!");
});

test("OpenAI Responses API 응답을 공통 문자열 형식으로 변환한다", async () => {
  const reply = await getAiReply("안녕", {
    env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key" },
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      return jsonResponse({ output_text: "반갑습니다!" });
    },
  });

  assert.equal(reply, "반갑습니다!");
});

test("Gemini 응답을 공통 문자열 형식으로 변환한다", async () => {
  const reply = await getAiReply("안녕", {
    env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" },
    fetchImpl: async (url, options) => {
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.equal(options.headers["x-goog-api-key"], "test-key");
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "안녕" }, { text: "하세요!" }] } }],
      });
    },
  });

  assert.equal(reply, "안녕하세요!");
});

test("외부 API 오류를 502 오류로 변환한다", async () => {
  await assert.rejects(
    getAiReply("안녕", {
      env: { AI_PROVIDER: "groq", GROQ_API_KEY: "test-key" },
      fetchImpl: async () => jsonResponse({ error: "nope" }, 429),
    }),
    (error) => error instanceof AiServiceError
      && error.statusCode === 502
      && error.code === "AI_UPSTREAM_ERROR",
  );
});

test("제공사별 토큰 한도·미완료 종료를 정상 문장으로 반환하지 않는다", async () => {
  for (const [provider, key, data] of [
    ["groq", "GROQ_API_KEY", { choices: [{ finish_reason: "length", message: { content: "문장처럼 끝나도." } }] }],
    ["openai", "OPENAI_API_KEY", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: "문장처럼 끝나도." }],
    ["gemini", "GEMINI_API_KEY", { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "문장처럼 끝나도." }] } }] }],
  ]) {
    await assert.rejects(getAiReply("안녕", {
      env: { AI_PROVIDER: provider, [key]: "test-key" },
      fetchImpl: async () => jsonResponse(data),
    }), (error) => error.code === "AI_INCOMPLETE_RESPONSE");
  }
});

test("서술용 토큰 예산은 낮은 기본 환경 설정보다 우선한다", async () => {
  for (const [provider, key, field, data] of [
    ["groq", "GROQ_API_KEY", "max_completion_tokens", { choices: [{ finish_reason: "stop", message: { content: "완결." } }] }],
    ["openai", "OPENAI_API_KEY", "max_output_tokens", { status: "completed", output_text: "완결." }],
    ["gemini", "GEMINI_API_KEY", "maxOutputTokens", { candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "비공개 추론" }, { text: "완결." }] } }] }],
  ]) {
    const reply = await getAiReply("안녕", {
      env: { AI_PROVIDER: provider, [key]: "test-key", AI_MAX_TOKENS: "10" },
      maxTokens: 3200,
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal((body.generationConfig || body)[field], 3200);
        return jsonResponse(data);
      },
    });
    assert.equal(reply, "완결.");
  }
});


