import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "../src/game/engine.js";
import { createInitialState, toPublicState } from "../src/game/state.js";
import { meetSceneNpcs } from "../src/game/social.js";

const makeEngine = () => new GameEngine({ rng: () => 0.95, narrator: async ({ resolution }) => ({ text: resolution.summary, mode: "test" }) });

test("시작 인연은 선택별로 표시하고 아직 만나지 않은 인물과 사적인 지식은 숨긴다", () => {
  for (const bond of ["missing_sibling", "herbalist_debt", "retired_guard"]) {
    const state = toPublicState(createInitialState({ bond }));
    assert.equal(state.startingBond.id, bond);
    assert.deepEqual(Object.keys(state.relationships), ["seo_yeonhwa", "gang_mujin"]);
    assert.equal("knownFacts" in state.relationships.gang_mujin, false);
    assert.equal(state.reputation.events.length, 0);
  }
});

test("치료는 관계의 이유·호의·은혜를 남기고 미선언 약속을 만들지 않는다", async () => {
  const engine = makeEngine();
  const start = await engine.start({ tenet: "keep_promise" });
  const turn = await engine.act(start.sessionId, { choiceId: "treat_courier" });
  const relation = turn.state.relationships.seo_yeonhwa;
  assert.equal(relation.debt, 1);
  assert.equal(relation.affection, 1);
  assert.match(relation.description, /상대가 내게 갚아야 할/);
  assert.ok(relation.recentEvents.some((event) => event.cause.includes("부상")));
  assert.equal(turn.state.promises.length, 0);
  assert.equal(turn.state.reputation.events[0].audience, "서연화");
  assert.equal(turn.state.facts.confirmed.some((entry) => entry.id === "planned_ambush"), false);
  assert.ok(turn.state.facts.claims.some((entry) => entry.id === "planned_ambush"));
  assert.doesNotMatch(JSON.stringify(turn.state.reputation), /강호 전체/);
  const privateState = engine.get(start.sessionId);
  privateState.context.lastChoiceId = null;
  await engine.act(start.sessionId, { choiceId: "treat_courier" });
  assert.equal(privateState.relationships.seo_yeonhwa.debt, 1);
  assert.equal(privateState.reputationEvents.length, 1);
});

test("뱃사공 대화는 존재하지 않는 비밀 보호나 빚을 만들지 않고 자유 입력의 상대도 구분한다", async () => {
  const engine = makeEngine();
  const start = await engine.start();
  const result = await engine.act(start.sessionId, { choiceId: "question_boatman" });
  assert.equal(result.state.debts.length, 0);
  assert.equal(result.state.relationships.gang_mujin.debt, 0);
  assert.doesNotMatch(JSON.stringify(result.state), /아들의 기록/);
  const next = await engine.act(start.sessionId, { message: "강무진에게 물길을 묻는다" });
  assert.ok(next.state.relationships.gang_mujin.trust > result.state.relationships.gang_mujin.trust);
  assert.equal(next.state.relationships.seo_yeonhwa.trust, 0);
});

test("두려움과 신뢰는 공존하며 높은 두려움만으로 적이 되지 않는다", () => {
  const state = createInitialState();
  Object.assign(state.relationships.seo_yeonhwa, { trust: 4, fear: 5, debt: -2 });
  const relation = toPublicState(state).relationships.seo_yeonhwa;
  assert.match(relation.stage, /신뢰와 두려움/);
  assert.doesNotMatch(relation.stage, /적대자/);
  assert.match(relation.description, /내가 상대에게 갚아야/);
});

test("구조 소문은 현장부터 퍼지고 구조한 인부에 대한 모순된 악평은 생기지 않는다", async () => {
  const engine = makeEngine();
  const start = await engine.start();
  const state = engine.get(start.sessionId);
  state.world.sceneId = "reed_warehouse";
  state.world.location = "갈대밭 폐창고";
  meetSceneNpcs(state);
  const rescue = await engine.act(start.sessionId, { choiceId: "rescue_workers" });
  assert.equal(rescue.state.reputation.events[0].audience, "구출된 인부들");
  assert.ok(rescue.state.relationships.mak_daeryong);
  await engine.act(start.sessionId, { choiceId: "steal_ledger" });
  assert.equal(state.delayedConsequences.some((event) => event.effect === "workers_hurt"), false);
  await engine.act(start.sessionId, { message: "잠시 휴식한다" });
  const spread = await engine.act(start.sessionId, { message: "호흡을 수련한다" });
  assert.ok(spread.state.reputation.events.some((event) => event.id === "workers_word_spread"));
  assert.equal(spread.state.reputation.events.some((event) => event.id === "workers_hurt"), false);
});

test("전달한 세력에만 증거를 건넨 평판을 기록한다", async () => {
  const engine = makeEngine();
  const start = await engine.start();
  const state = engine.get(start.sessionId);
  state.world.sceneId = "cheongryu_gate";
  state.world.location = "청류현 남문";
  meetSceneNpcs(state);
  const result = await engine.act(start.sessionId, { choiceId: "contact_crane" });
  assert.equal(result.state.reputation.events[0].audience, "백학문");
  assert.equal(result.state.reputation.factions.length, 1);
  assert.equal(result.state.reputation.factions[0].name, "백학문");
});
