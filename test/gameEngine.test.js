import assert from "node:assert/strict";
import test from "node:test";

import { GameEngine } from "../src/game/engine.js";
import { refreshGrowth } from "../src/game/growth.js";
import { normalizeNarration } from "../src/game/narrator.js";

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
  const started = await engine.start({ name: "담우", talent: "keen_eye" });
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

test("문장에 섞인 br 태그는 실제 줄바꿈으로 정리한다", () => {
  const text = normalizeNarration("첫 문장<br/><br/>둘째 문장<br>셋째 문장");
  assert.equal(text, "첫 문장\n\n둘째 문장\n셋째 문장");
  assert.doesNotMatch(text, /<br/i);
});

test("행동 이후 제안은 새 단서와 직전 선택을 반영해 달라진다", async () => {
  const engine = engineWithRolls(0.95);
  const started = await engine.start({ name: "담우", talent: "keen_eye" });
  const beforeLabels = started.choices.map((choice) => choice.label);
  const result = await engine.act(started.sessionId, { choiceId: "inspect_tracks" });
  const afterLabels = result.choices.map((choice) => choice.label);

  assert.notDeepEqual(afterLabels, beforeLabels);
  assert.ok(afterLabels.some((label) => label.includes("방금 확인한")));
  assert.equal(result.resolution.actionNarration, `${beforeLabels[1]}.`);
  assert.doesNotMatch(result.resolution.actionNarration, /행동의 목표와 순서|성공 가능성/);
  assert.doesNotMatch(result.resolution.actionNarration, /는다기로|한다기로/);
  assert.doesNotMatch(result.resolution.actionNarration, /<br/i);
});

test("수련은 무공 숙련을 올리고 서로 다른 빌드 분기를 연다", async () => {
  const engine = engineWithRolls(0.95, 0.95, 0.95);
  const started = await engine.start({ martialPath: "flowing_sword" });
  await engine.act(started.sessionId, { message: "유수검의 호흡과 초식을 수련한다" });
  const second = await engine.act(started.sessionId, { message: "흐르는 힘의 연결을 바꾸어 수련한다" });

  assert.ok(second.state.player.martialArts[0].mastery >= 8);
  assert.equal(second.state.player.realm.name, "삼류");
  assert.ok(second.choices.some((choice) => choice.id === "build:flowing_sword:returning_current"));
  assert.ok(second.choices.some((choice) => choice.id === "build:flowing_sword:rushing_current"));

  const branched = await engine.act(started.sessionId, {
    choiceId: "build:flowing_sword:returning_current",
  });
  assert.equal(branched.state.player.martialArts[0].branch.name, "회류");
  assert.ok(branched.state.player.martialArts[0].techniques.some((technique) => technique.name === "회류반월"));
});

test("경지 돌파는 숙련 외 복수 조건을 요구하며 삼류에서 이류로 오른다", async () => {
  const engine = engineWithRolls(0.95);
  const started = await engine.start({ martialPath: "stone_fist" });
  const privateState = engine.get(started.sessionId);
  privateState.player.martialArts[0].mastery = 10;
  privateState.player.progress.practice = 4;
  privateState.player.progress.combatExperience = 1;
  privateState.player.progress.insight = 1;
  privateState.player.progress.bodyCondition = 1;
  refreshGrowth(privateState.player);

  const result = await engine.act(started.sessionId, { message: "모든 준비를 하나로 모아 경지 돌파를 시도한다" });
  assert.equal(result.state.player.realm.name, "이류");
  assert.ok(result.resolution.growth.includes("이류 경지 도달"));
});

