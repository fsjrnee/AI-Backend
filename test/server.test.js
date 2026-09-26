import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../server.js";
import { GameEngine } from "../src/game/engine.js";
import { AiServiceError } from "../src/services/aiService.js";
import { isCompleteNarration } from "../src/game/narrator.js";

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
    assert.match(html, /무림초행/);
    assert.match(html, /현재 상황에서 시도해 볼 만한 행동/);
    assert.match(html, /무공과 성장/);

    const script = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.doesNotMatch(script, /d20=|난이도 \$\{/);
  });
});

test("게임 생성과 행동 API가 상태와 판정 결과를 반환한다", async () => {
  const gameEngine = new GameEngine({
    rng: () => 0.9,
    narrator: async ({ resolution }) => ({ text: resolution.summary, mode: "test" }),
  });
  const app = createApp({ gameEngine });

  await withServer(app, async (baseUrl) => {
    const startResponse = await fetch(`${baseUrl}/api/game/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: { name: "연무" } }),
    });
    const started = await startResponse.json();

    assert.equal(startResponse.status, 201);
    assert.equal(started.state.player.name, "연무");

    const actionResponse = await fetch(`${baseUrl}/api/game/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: started.sessionId, choiceId: "inspect_tracks" }),
    });
    const action = await actionResponse.json();

    assert.equal(actionResponse.status, 200);
    assert.ok(action.resolution.roll);
    assert.ok(action.state.clues.length >= 1);
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

test("실제 게임 API 경로는 짧은 AI 응답에도 500자 이상의 본문을 반환한다", async () => {
  await withServer(createApp({ chatService: async () => "짧은 문장." }), async (baseUrl) => {
    const started = await (await fetch(`${baseUrl}/api/game/start`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ character: {} }),
    })).json();
    assert.ok(isCompleteNarration(started.reply));
    for (const message of ["수레를 조사한다", "현재 상태", "시간을 되돌려 사건을 없앤다", "잠시 휴식한다"]) {
      const response = await fetch(`${baseUrl}/api/game/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: started.sessionId, message }),
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.ok(isCompleteNarration(result.reply));
      assert.equal(result.narrationMode, "fallback");
    }
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
    assert.deepEqual(await response.json(), {
      error: "AI가 준비되지 않았습니다.",
      code: "AI_NOT_CONFIGURED",
    });
  });
});

