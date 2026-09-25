import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../server.js";
import { AiServiceError } from "../src/services/aiService.js";

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("정적 채팅 화면을 제공한다", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /간단한 AI 채팅/);
  });
});

test("POST /api/chat은 reply JSON을 반환한다", async () => {
  const app = createApp({ chatService: async (message) => `${message} 응답` });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "안녕" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: "안녕 응답" });
  });
});

test("빈 메시지는 400을 반환한다", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "메시지를 입력해 주세요." });
  });
});

test("AI 서비스 오류의 상태 코드와 메시지를 전달한다", async () => {
  const app = createApp({
    chatService: async () => {
      throw new AiServiceError("AI가 준비되지 않았습니다.", 503, "AI_NOT_CONFIGURED");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "안녕" }),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "AI가 준비되지 않았습니다." });
  });
});


