import assert from "node:assert/strict";
import test from "node:test";

import { GameEngine } from "../src/game/engine.js";

const narrator = async ({ resolution }) => ({
  text: `판정: ${resolution.outcome} / ${resolution.summary}`,
  mode: "test",
});

function engineWithRolls(...rolls) {
  let index = 0;
  return new GameEngine({
    narrator,
    rng: () => rolls[Math.min(index++, rolls.length - 1)] ?? 0.75,
  });
}

test("새 게임은 의미 있는 캐릭터 선택과 비공개 GM 상태를 분리한다", async () => {
  const engine = engineWithRolls(0.9);
  const result = await engine.start({
    name: "설화",
    origin: "merchant_apprentice",
    talent: "keen_eye",
    tenet: "expose_truth",
    martialPath: "healing_needles",
  });

  assert.equal(result.state.player.name, "설화");
  assert.equal(result.state.player.origin, "merchant_apprentice");
  assert.ok(result.state.player.stats.wits >= 3);
  assert.equal("gm" in result.state, false);
  assert.equal(result.choices.length, 4);
  assert.match(result.reply, /설화가 강호에/);
});

test("현장 조사는 단서, 사건 진행도, 기록을 실제로 바꾼다", async () => {
  const engine = engineWithRolls(0.95);
  const started = await engine.start({ talent: "keen_eye" });
  const result = await engine.act(started.sessionId, { choiceId: "inspect_tracks" });

  assert.equal(result.resolution.outcome, "strong_success");
  assert.ok(result.state.clues.some((clue) => clue.id === "black_salt_residue"));
  assert.ok(result.state.quests.stolenMedicine.progress > 0);
  assert.ok(result.state.recentChanges.some((change) => change.path.includes("progress")));
});

test("창의적인 자유 입력은 구체적 환경 활용만 판정 우세로 반영한다", async () => {
  const engine = engineWithRolls(0.55);
  const started = await engine.start({});
  const result = await engine.act(started.sessionId, {
    message: "진흙에 밧줄을 묻어 발자국의 깊이를 비교하며 수레의 방향을 조사한다",
  });

  assert.equal(result.resolution.intent, "investigate");
  assert.ok(result.resolution.advantages.includes("환경을 구체적으로 활용함"));
  assert.ok(result.resolution.roll);
});

test("세계 규칙상 불가능한 행동은 거절 이유와 대체 접근을 남긴다", async () => {
  const engine = engineWithRolls(0.9);
  const started = await engine.start({});
  const result = await engine.act(started.sessionId, {
    message: "시간을 되돌려 약재 수레가 습격당하지 않게 한다",
  });

  assert.equal(result.resolution.outcome, "impossible");
  assert.match(result.resolution.summary, /세계 법칙/);
  assert.match(result.resolution.changedSituation, /여러 단계/);
  assert.equal(result.state.turn, 0);
});

test("실패는 부상과 경계를 남기지만 게임을 종료하지 않는다", async () => {
  const engine = engineWithRolls(0);
  const started = await engine.start({});
  const beforeHealth = started.state.player.resources.health;
  const result = await engine.act(started.sessionId, {
    message: "무작정 검을 뽑아 앞을 막은 자를 공격한다",
  });

  assert.equal(result.resolution.outcome, "critical_failure");
  assert.ok(result.state.player.resources.health < beforeHealth);
  assert.ok(result.state.combat);
  assert.equal(result.state.quests.stolenMedicine.status, "active");
});

test("같은 행동과 같은 장면이 반복되면 복수 신호에 의해 변주가 개입한다", async () => {
  const engine = engineWithRolls(0.9, 0.9, 0.9);
  const started = await engine.start({});
  await engine.act(started.sessionId, { message: "잠시 앉아서 휴식한다" });
  await engine.act(started.sessionId, { message: "다시 자리를 지키며 휴식한다" });
  const third = await engine.act(started.sessionId, { message: "한 번 더 움직이지 않고 휴식한다" });

  assert.ok(third.resolution.intervention);
  assert.ok(third.state.clues.some((clue) => clue.id === "independent_npc_move")
    || third.state.world.sceneId !== "baekro_dock");
});

test("충분한 진행은 다음 장소와 다른 장면 유형을 연다", async () => {
  const engine = engineWithRolls(0.95, 0.95, 0.95);
  const started = await engine.start({});
  await engine.act(started.sessionId, { choiceId: "inspect_tracks" });
  await engine.act(started.sessionId, { choiceId: "treat_courier" });
  const result = await engine.act(started.sessionId, { choiceId: "question_boatman" });

  assert.equal(result.state.world.sceneId, "reed_warehouse");
  assert.equal(result.state.scene.type, "침투");
  assert.ok(result.resolution.sceneTransition);
});

