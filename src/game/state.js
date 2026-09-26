import { CHARACTER_OPTIONS, FACTIONS, NPCS, SCENES, findOption } from "./content.js";
import { createMartialProgress, getRealmSnapshot } from "./growth.js";
import { meetSceneNpcs, publicRelations, publicReputation, startingBond } from "./social.js";

const DEFAULT_SELECTIONS = {
  origin: "border_refugee",
  past: "false_accusation",
  talent: "keen_eye",
  tenet: "keep_promise",
  bond: "missing_sibling",
  martialPath: "flowing_sword",
  longGoal: "find_family",
};

export function createInitialState(character = {}) {
  const selected = validateCharacterSelection(character);
  const stats = {
    body: 1,
    agility: 1,
    wits: 1,
    spirit: 1,
    presence: 1,
    martial: 1,
    survival: 0,
  };
  let coins = 18;

  for (const [group, key] of [
    ["origins", selected.origin],
    ["talents", selected.talent],
    ["martialPaths", selected.martialPath],
  ]) {
    const option = findOption(group, key);
    for (const [stat, value] of Object.entries(option?.effects || {})) {
      if (stat === "coins") coins += value;
      else stats[stat] = (stats[stat] || 0) + value;
    }
  }

  const maxHealth = 14 + stats.body * 2;
  const maxQi = 8 + stats.spirit * 2;
  const maxBalance = 4 + stats.agility;
  const martialArts = [createMartialProgress(selected.martialPath)];
  const progress = { practice: 0, combatExperience: 0, insight: 0, bodyCondition: 1 };

  const state = {
    version: 3,
    turn: 0,
    chapter: 1,
    player: {
      name: selected.name,
      origin: selected.origin,
      past: selected.past,
      talent: selected.talent,
      tenet: selected.tenet,
      bond: selected.bond,
      martialPath: selected.martialPath,
      longGoal: selected.longGoal,
      realm: getRealmSnapshot(0, progress, martialArts),
      stats,
      resources: {
        health: maxHealth,
        maxHealth,
        qi: maxQi,
        maxQi,
        balance: maxBalance,
        maxBalance,
        coins,
        time: 6,
      },
      martialArts,
      conditions: [],
      inventory: [
        { id: "travel_rations", name: "마른 양식", quantity: 2 },
        { id: "cloth_bandage", name: "깨끗한 천", quantity: 1 },
        { id: "worn_token", name: "낡은 인연패", quantity: 1 },
      ],
      reputation: { fame: 0, notoriety: 0, mercy: 0, reliability: 0 },
      progress,
      growthLog: [
        { turn: 0, type: "foundation", text: `${martialArts[0].name}의 입문 초식을 익혔다.` },
      ],
    },
    world: {
      day: 1,
      period: "늦은 오후",
      location: SCENES.baekro_dock.location,
      regionId: "baekro_dock",
      weather: "가랑비",
      alert: 0,
      sceneId: "baekro_dock",
      sceneProgress: 0,
      campaignClock: 0,
    },
    combat: null,
    goals: {
      active: [
        "해 지기 전에 도난당한 약재의 행방을 찾는다",
        selected.longGoalLabel,
      ],
      completed: [],
      failed: [],
    },
    quests: {
      stolenMedicine: {
        id: "stolenMedicine",
        title: "검은 소금과 사라진 약재",
        type: "지역 사건",
        status: "active",
        progress: 0,
        deadline: 6,
        knownStakes: "열병 환자들의 약이 오늘 밤 필요하다",
        paths: [],
      },
    },
    clues: [],
    relationships: {
      seo_yeonhwa: relation(0, 0, 0, 0, 2, ["약재 수레가 계획적으로 습격당했다"]),
      gang_mujin: relation(0, 0, 0, 0, 1, ["동쪽 갈대밭으로 간 배를 보았다"]),
      mak_daeryong: relation(-1, 0, 0, 0, 1, []),
    },
    factions: Object.fromEntries(
      FACTIONS.map((faction) => [faction.id, { standing: 0, heat: 0, clock: 0 }]),
    ),
    promises: [],
    debts: [],
    grudges: [],
    reputationEvents: [],
    completedSocialEvents: [],
    delayedConsequences: [],
    context: {
      lastIntent: null,
      lastOutcome: null,
      lastChoiceId: null,
      lastDeclaration: null,
      newestClues: [],
    },
    recentScenes: [],
    fatigue: {
      lastIntent: null,
      repeatedIntent: 0,
      sameSceneType: 0,
      shortInputs: 0,
      passiveInputs: 0,
      stagnantTurns: 0,
      boredomScore: 0,
      lastIntervention: null,
    },
    facts: {
      confirmed: [
        { id: "medicine_stolen", text: "빈민가로 가던 열병 약재 수레가 백로진 나루에서 사라졌다", source: "현장" },
      ],
      claims: [
        { id: "river_blame", text: "수로맹이 약재를 빼돌렸다는 소문", speaker: "부두 상인들", reliability: "낮음" },
      ],
      rumors: [
        { id: "black_salt", text: "검은 소금 표식이 붙은 화물은 장부에 남지 않는다", source: "떠돌이 짐꾼" },
      ],
    },
    history: [],
    gm: {
      secretClock: 0,
      secretFacts: [
        "약재 절도는 수로맹 전체가 아니라 만리상단 내부 인물과 결탁한 갈고리패의 일이다",
        "도난 장부에는 천기맥도의 수맥 표식 하나가 숨어 있다",
        "플레이어의 낡은 인연패와 같은 문양이 장부 봉인에 쓰였다",
      ],
      npcPlans: Object.fromEntries(
        NPCS.map((npc) => [npc.id, { step: 0, active: ["seo_yeonhwa", "gang_mujin", "mak_daeryong"].includes(npc.id) }]),
      ),
    },
  };
  meetSceneNpcs(state);
  return state;
}

export function validateCharacterSelection(character) {
  const output = {
    name: sanitizeName(character.name),
  };

  for (const [field, group] of [
    ["origin", "origins"],
    ["past", "pasts"],
    ["talent", "talents"],
    ["tenet", "tenets"],
    ["bond", "bonds"],
    ["martialPath", "martialPaths"],
    ["longGoal", "goals"],
  ]) {
    const requested = character[field] || DEFAULT_SELECTIONS[field];
    const option = findOption(group, requested);
    const fallback = findOption(group, DEFAULT_SELECTIONS[field]);
    output[field] = (option || fallback).id;
    output[`${field}Label`] = (option || fallback).name;
  }

  return output;
}

export function recordChange(state, {
  path,
  before,
  after,
  cause,
  visibility = "public",
  related = [],
  futureImpact = null,
}) {
  if (Object.is(before, after)) return;

  state.history.push({
    turn: state.turn,
    path,
    before,
    cause,
    change: describeChange(before, after),
    after,
    visibility,
    related,
    futureImpact,
  });

  if (state.history.length > 80) {
    state.history = state.history.slice(-80);
  }
}

export function toPublicState(state) {
  const scene = SCENES[state.world.sceneId] || SCENES.baekro_dock;

  return {
    version: state.version,
    sessionId: state.sessionId,
    turn: state.turn,
    chapter: state.chapter,
    player: structuredClone(state.player),
    world: structuredClone(state.world),
    combat: structuredClone(state.combat),
    goals: structuredClone(state.goals),
    quests: structuredClone(state.quests),
    clues: structuredClone(state.clues),
    relationships: publicRelations(state),
    startingBond: startingBond(state),
    reputation: publicReputation(state),
    factions: structuredClone(state.factions),
    promises: structuredClone(state.promises),
    debts: structuredClone(state.debts),
    grudges: structuredClone(state.grudges),
    delayedConsequences: state.delayedConsequences
      .filter((entry) => entry.visibility === "public")
      .map((entry) => structuredClone(entry)),
    context: structuredClone(state.context),
    recentScenes: structuredClone(state.recentScenes.slice(-6)),
    fatigue: structuredClone(state.fatigue),
    facts: structuredClone(state.facts),
    recentChanges: state.history
      .filter((entry) => entry.visibility === "public")
      .slice(-8)
      .map((entry) => structuredClone(entry)),
    scene: {
      id: scene.id,
      location: scene.location,
      type: scene.type,
      intensity: scene.intensity,
      objective: scene.objective,
      sensory: scene.sensory,
      stakes: scene.stakes,
    },
  };
}

function relation(trust, affection, fear, debt, interest, knownFacts) {
  return { trust, affection, fear, debt, interest, knownFacts, stage: "낯선 사이" };
}

function sanitizeName(value) {
  if (typeof value !== "string") return "무명";
  const clean = value.trim().replace(/[<>]/g, "").slice(0, 16);
  return clean || "무명";
}

function describeChange(before, after) {
  if (typeof before === "number" && typeof after === "number") {
    const delta = after - before;
    return `${delta >= 0 ? "+" : ""}${delta}`;
  }
  return "변경";
}

