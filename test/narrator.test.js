import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../src/game/state.js";
import { SCENES } from "../src/game/content.js";
import { INTENT_PROSE, OUTCOME_PROSE } from "../src/game/prose.js";
import { fallbackNarration, introductionNarration, isCompleteNarration, narrateTurn, narrationLength } from "../src/game/narrator.js";
import { GameEngine } from "../src/game/engine.js";
import { AiServiceError } from "../src/services/aiService.js";

const resolution = { intent: "investigate", outcome: "success", summary: "진흙에서 밧줄 자국을 확인했다.", costs: [], gains: [], growth: [], revealedClues: [] };

test("도입과 모든 장면·행동·결과의 대체 서술은 공백 제외 500자와 완결성을 충족한다", () => {
  const state = createInitialState();
  assert.ok(isCompleteNarration(introductionNarration(state)));
  for (const sceneId of Object.keys(SCENES)) {
    state.world.sceneId = sceneId;
    for (const intent of Object.keys(INTENT_PROSE)) {
      for (const outcome of Object.keys(OUTCOME_PROSE)) {
        const text = fallbackNarration(state, { ...resolution, intent, outcome });
        assert.ok(isCompleteNarration(text), `${sceneId}/${intent}/${outcome}: ${narrationLength(text)}`);
        assert.doesNotMatch(text, /<br|대가:|무공의 변화:|d20=/);
      }
    }
  }
});

test("짧은 응답은 재작성하며 이미 적용된 게임 행동은 한 번만 판정한다", async () => {
  let calls = 0;
  const engine = new GameEngine({ rng: () => 0.95, narrator: (context) => narrateTurn({ ...context, chatService: async (_prompt, options) => {
    calls += 1;
    assert.ok(options.maxTokens >= 3200);
    return calls === 1 ? "흔적을 찾았다." : fallbackNarration(context.state, context.resolution);
  } }) });
  const started = await engine.start();
  const turn = await engine.act(started.sessionId, { choiceId: "inspect_tracks" });
  assert.equal(calls, 2);
  assert.equal(turn.state.turn, 1);
  assert.equal(turn.state.quests.stolenMedicine.progress, 22);
  assert.equal(turn.narrationMode, "ai");
  assert.ok(isCompleteNarration(turn.reply));
});

test("문장 중간 절단, 열린 따옴표, 토큰 한도 종료는 대체 서술로 안전하게 끝낸다", async () => {
  const state = createInitialState();
  const good = fallbackNarration(state, resolution);
  for (const bad of [good.slice(0, -5), `“${good}`, `${good}\n\n이어지는 말은`, "", " ".repeat(800)]) {
    let calls = 0;
    const result = await narrateTurn({ state, resolution, action: "조사한다", chatService: async () => { calls++; return bad; } });
    assert.equal(result.mode, "fallback");
    assert.equal(calls, 2);
    assert.ok(isCompleteNarration(result.text));
  }
  let calls = 0;
  const result = await narrateTurn({ state, resolution, action: "조사한다", chatService: async () => { calls++; throw new AiServiceError("truncated", 502, "AI_INCOMPLETE_RESPONSE"); } });
  assert.equal(calls, 2);
  assert.ok(isCompleteNarration(result.text));
});

test("설정·네트워크·시간 초과는 불필요한 재호출 없이 긴 장면으로 대체한다", async () => {
  const state = createInitialState();
  for (const code of ["AI_NOT_CONFIGURED", "AI_TIMEOUT", "AI_UPSTREAM_ERROR"]) {
    let calls = 0;
    const result = await narrateTurn({ state, resolution, action: "조사한다", chatService: async () => { calls++; throw new AiServiceError("failed", 502, code); } });
    assert.equal(calls, 1);
    assert.equal(result.mode, "fallback");
    assert.ok(isCompleteNarration(result.text));
  }
});

test("전환 턴은 출발 장면과 도착 장면을 구분하고 비공개 사실을 프롬프트에 넣지 않는다", async () => {
  const state = createInitialState();
  state.world.sceneId = "reed_warehouse";
  state.world.location = SCENES.reed_warehouse.location;
  state.gm.secretFacts.push("절대로 전달하면 안 되는 비밀");
  const moved = { ...resolution, sourceSceneId: "baekro_dock", sceneTransition: { from: "baekro_dock", to: "reed_warehouse" } };
  const text = fallbackNarration(state, moved);
  assert.match(text, /나루/);
  assert.match(text, /갈대밭 폐창고에 이르자/);
  await narrateTurn({ state, resolution: moved, action: "추적한다", chatService: async (prompt) => {
    const data = JSON.parse(prompt);
    assert.equal(data.previousScene.id, "baekro_dock");
    assert.equal(data.visibleState.location, "갈대밭 폐창고");
    assert.doesNotMatch(prompt, /절대로 전달하면 안 되는 비밀|secretFacts/);
    return text;
  } });
});
