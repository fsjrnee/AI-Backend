import crypto from "node:crypto";

import { ENEMIES, NPCS, SCENES } from "./content.js";
import {
  MARTIAL_DEFINITIONS,
  REALM_LADDER,
  getBranchChoiceOptions,
  refreshGrowth,
  selectBuildBranch,
} from "./growth.js";
import { introductionNarration, narrateTurn } from "./narrator.js";
import { createInitialState, recordChange, toPublicState } from "./state.js";

const DIFFICULTIES = {
  trivial: { name: "평이", dc: 0 },
  easy: { name: "쉬움", dc: 8 },
  normal: { name: "보통", dc: 11 },
  hard: { name: "어려움", dc: 14 },
  severe: { name: "극난", dc: 17 },
};

export class GameError extends Error {
  constructor(message, statusCode = 400, code = "GAME_ERROR") {
    super(message);
    this.name = "GameError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class GameEngine {
  constructor({ narrator = narrateTurn, rng = Math.random } = {}) {
    this.sessions = new Map();
    this.narrator = narrator;
    this.rng = rng;
  }

  async start(character = {}) {
    const state = createInitialState(character);
    state.sessionId = crypto.randomUUID();
    this.sessions.set(state.sessionId, state);

    return {
      sessionId: state.sessionId,
      reply: introductionNarration(state),
      narrationMode: "rules",
      resolution: {
        outcome: "introduction",
        summary: "강호에 첫발을 들였다.",
      },
      state: toPublicState(state),
      choices: this.getChoices(state),
    };
  }

  get(sessionId) {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new GameError(
        "게임 상태를 찾을 수 없습니다. 서버가 재시작되었거나 세션이 만료되었습니다.",
        404,
        "SESSION_NOT_FOUND",
      );
    }
    return state;
  }

  inspect(sessionId) {
    const state = this.get(sessionId);
    return { state: toPublicState(state), choices: this.getChoices(state) };
  }

  async act(sessionId, { message, choiceId } = {}) {
    const state = this.get(sessionId);
    const choice = this.findChoice(state, choiceId);
    const declaration = normalizeDeclaration(message, choice);

    if (!declaration) {
      throw new GameError("행동을 입력하거나 선택지를 골라 주세요.", 400, "EMPTY_ACTION");
    }
    if (declaration.length > 600) {
      throw new GameError("한 번의 행동은 600자 이내로 입력해 주세요.", 400, "ACTION_TOO_LONG");
    }

    const intent = classifyIntent(declaration, choice?.intent);
    if (intent === "status") {
      const resolution = makeResolution(intent, declaration);
      resolution.outcome = "automatic";
      resolution.summary = `${state.player.name}은 호흡을 고르고 현재 상황을 확인했다.`;
      resolution.changedSituation = "시간은 흐르지 않았다.";
      resolution.actionNarration = describePlayerAction(state, { declaration, intent }, resolution);
      const narration = await this.narrator({ state, action: declaration, resolution });
      return this.response(state, resolution, narration);
    }

    const resolution = this.resolveTurn(state, {
      declaration,
      intent,
      choice,
    });
    const narration = await this.narrator({ state, action: declaration, resolution });
    return this.response(state, resolution, narration);
  }

  resolveTurn(state, action) {
    const resolution = makeResolution(action.intent, action.declaration);
    const dueEvents = processDueConsequences(state);
    resolution.preEvents.push(...dueEvents);

    const impossible = impossibleReason(state, action);
    if (impossible) {
      resolution.outcome = "impossible";
      resolution.summary = impossible.reason;
      resolution.changedSituation = impossible.alternatives;
      resolution.gains.push("가능한 대체 접근을 파악함");
      resolution.actionNarration = describePlayerAction(state, action, resolution);
      updateFatigue(state, action, resolution, false);
      return resolution;
    }

    state.turn += 1;
    state.world.campaignClock += 1;
    spendTime(state, action.intent === "rest" ? 2 : 1, resolution);

    const difficulty = chooseDifficulty(state, action);
    const modifierResult = calculateModifier(state, action);
    resolution.difficulty = difficulty;
    resolution.advantages = modifierResult.advantages;
    resolution.disadvantages = modifierResult.disadvantages;

    if (difficulty.dc === 0) {
      resolution.outcome = "automatic";
      resolution.roll = null;
    } else {
      const die = 1 + Math.floor(this.rng() * 20);
      const total = die + modifierResult.total;
      resolution.roll = {
        die: `d20=${die}`,
        modifier: modifierResult.total,
        total,
        dc: difficulty.dc,
        visibility: "public",
      };
      resolution.outcome = determineOutcome(die, total, difficulty.dc);
    }

    const beforeProgress = state.quests.stolenMedicine.progress;
    const beforeClues = state.clues.length;
    const beforeRelationTotal = relationTotal(state);

    if (state.combat) {
      resolveCombatTurn(state, action, resolution);
    } else {
      applyIntentEffects(state, action, resolution);
      applyChoiceEffects(state, action, resolution);
    }

    applyGrowthProgress(state, action, resolution);

    updateQuestProgress(state, action, resolution);
    applySceneTransition(state, action, resolution);
    runNpcPlans(state, resolution);

    const meaningfulChange = state.quests.stolenMedicine.progress !== beforeProgress
      || state.clues.length !== beforeClues
      || relationTotal(state) !== beforeRelationTotal
      || Boolean(resolution.sceneTransition);
    updateFatigue(state, action, resolution, meaningfulChange);
    maybeInterveneForBoredom(state, resolution);
    recordScene(state, action, resolution);
    resolution.actionNarration = describePlayerAction(state, action, resolution);
    state.context = {
      lastIntent: action.intent,
      lastOutcome: resolution.outcome,
      lastChoiceId: action.choice?.id || null,
      lastDeclaration: action.declaration,
      newestClues: [...resolution.revealedClues],
    };

    return resolution;
  }

  getChoices(state) {
    return contextualChoices(state);
  }

  findChoice(state, choiceId) {
    if (!choiceId) return null;
    const choice = this.getChoices(state).find((candidate) => candidate.id === choiceId);
    if (!choice) {
      throw new GameError("현재 장면에서 사용할 수 없는 선택지입니다.", 400, "INVALID_CHOICE");
    }
    return choice;
  }

  response(state, resolution, narration) {
    return {
      sessionId: state.sessionId,
      reply: narration.text,
      narrationMode: narration.mode,
      warning: narration.warning,
      resolution: publicResolution(resolution),
      state: toPublicState(state),
      choices: this.getChoices(state),
    };
  }
}

function normalizeDeclaration(message, choice) {
  if (typeof message === "string" && message.trim()) return message.trim();
  return choice?.label || "";
}

function classifyIntent(text, forcedIntent) {
  if (forcedIntent) return forcedIntent;
  const checks = [
    ["status", /(상태|현황|소지품|목표|단서|관계|스탯)/],
    ["breakthrough", /(경지.*돌파|돌파.*경지|벽을 넘|다음 경지|승급)/],
    ["rest", /(쉰|휴식|잠|치료|붕대|약을|운기조식)/],
    ["train", /(수련|연습|명상|호흡|초식.*익|단련)/],
    ["defend", /(방어|막아|피해|회피|반격 준비|자세를 낮)/],
    ["combat", /(공격|베어|찌르|주먹|발차기|싸우|제압|무기를 휘|목을)/],
    ["investigate", /(조사|살펴|관찰|흔적|단서|뒤져|냄새|자국|장부.*읽)/],
    ["talk", /(말을|묻|대화|설득|협상|거래|속이|위협|사과|약속)/],
    ["move", /(이동|가겠다|간다|떠나|추적|쫓|도망|숨어|잠입|오른다|건너)/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "creative";
}

function impossibleReason(state, action) {
  if (action.intent === "breakthrough" && !state.player.realm.nextName) {
    return {
      reason: "조화경 너머는 정해진 경지가 아니라 스스로 증명해야 할 무학의 완성이다.",
      alternatives: "새 무공을 창안하거나 강호의 질서를 바꾸는 장기 목표로 자신의 도를 증명할 수 있다.",
    };
  }

  if (action.intent === "breakthrough" && !state.player.realm.eligible) {
    const missing = Object.entries(state.player.realm.readiness || {})
      .filter(([, value]) => !value.met)
      .map(([key, value]) => `${growthLabel(key)} ${value.current}/${value.required}`)
      .join(", ");
    return {
      reason: `${state.player.realm.nextName}으로 오르기에는 준비가 부족하다. 부족한 조건: ${missing}.`,
      alternatives: "같은 수련을 되풀이하기보다 실전, 깨달음, 신체 단련을 서로 다른 장면에서 채워야 한다.",
    };
  }

  if (/(하늘.*날|죽은.*살|시간.*돌|한 번에.*산.*가르|순간이동)/.test(action.declaration)) {
    return {
      reason: "현재 경지와 세계 법칙으로는 그 행동을 그대로 실행할 수 없다.",
      alternatives: "도구를 구하거나, 높은 곳과 경공을 이용하거나, 같은 목표를 여러 단계로 나누어 시도할 수 있다.",
    };
  }

  if (/(천마|절정고수|문주).*죽|문파 전체.*혼자/.test(action.declaration)
    && state.player.realm.index <= 1) {
    return {
      reason: "삼류 무인이 정면에서 감당할 수 있는 힘의 차이가 아니다.",
      alternatives: "정보를 모으고 약점을 만들거나, 동맹·지형·함정·협상을 이용해 목표를 바꿀 수 있다.",
    };
  }
  return null;
}

function chooseDifficulty(state, action) {
  if (action.intent === "rest" && !state.combat) return DIFFICULTIES.trivial;
  if (action.intent === "train") return state.player.resources.qi >= 3 ? DIFFICULTIES.easy : DIFFICULTIES.hard;
  if (action.intent === "breakthrough") return DIFFICULTIES.hard;
  if (state.combat) {
    if (action.intent === "defend") return DIFFICULTIES.normal;
    if (action.intent === "talk") return DIFFICULTIES.hard;
    if (action.intent === "move") return DIFFICULTIES.hard;
    return DIFFICULTIES.hard;
  }
  if (action.choice?.id === "chase_shadow" || action.choice?.id === "challenge_guard") return DIFFICULTIES.hard;
  if (action.intent === "creative") return DIFFICULTIES.hard;
  if (state.fatigue.repeatedIntent >= 2) return DIFFICULTIES.hard;
  return DIFFICULTIES.normal;
}

function calculateModifier(state, action) {
  const stats = state.player.stats;
  const mapping = {
    investigate: "wits",
    talk: "presence",
    combat: "martial",
    defend: "agility",
    move: "agility",
    train: "spirit",
    breakthrough: "spirit",
    rest: "spirit",
  };
  const stat = mapping[action.intent];
  let total = stat ? stats[stat] : Math.max(stats.wits, stats.spirit, stats.agility);
  const advantages = [];
  const disadvantages = [];

  if (action.intent === "combat") {
    total += Math.floor(Math.max(stats.body, stats.agility) / 2);
  }
  if (state.player.talent === "keen_eye" && action.intent === "investigate") {
    total += 1;
    advantages.push("예리한 눈");
  }
  if (state.player.talent === "quick_step" && ["move", "defend"].includes(action.intent)) {
    total += 1;
    advantages.push("가벼운 발");
  }
  if (state.player.talent === "calm_breath" && ["train", "talk"].includes(action.intent)) {
    total += 1;
    advantages.push("고른 호흡");
  }
  if (state.player.talent === "iron_bones" && action.intent === "combat") {
    total += 1;
    advantages.push("강골");
  }
  if (state.clues.length >= 2 && ["investigate", "talk"].includes(action.intent)) {
    total += 1;
    advantages.push("연결된 단서");
  }
  if (state.player.conditions.length) {
    total -= 1;
    disadvantages.push("지속 상태");
  }
  if (state.fatigue.repeatedIntent >= 2) {
    total -= 2;
    disadvantages.push("같은 수법이 읽힘");
  }
  if (/(준비|밧줄|등잔|진흙|난간|바람|소리|연기)/.test(action.declaration)) {
    total += 1;
    advantages.push("환경을 구체적으로 활용함");
  }
  if (/(무작정|닥치고|눈 감고|전부 건다)/.test(action.declaration)) {
    total -= 1;
    disadvantages.push("무모한 접근");
  }

  const activeBranch = state.player.martialArts.find((art) => art.branch)?.branch;
  if (activeBranch?.bonusIntents.includes(action.intent)) {
    total += 1;
    advantages.push(`${activeBranch.name} 계통의 장기`);
  }
  if (activeBranch?.penaltyIntents.includes(action.intent)) {
    total -= 1;
    disadvantages.push(`${activeBranch.name} 계통의 교환조건`);
  }

  return { total, advantages, disadvantages };
}

function determineOutcome(die, total, dc) {
  if (die === 1 || total <= dc - 5) return "critical_failure";
  if (total >= dc + 5) return "strong_success";
  if (total >= dc) return "success";
  if (total >= dc - 3) return "costly_success";
  return "failure";
}

function makeResolution(intent, declaration) {
  return {
    intent,
    declaration,
    outcome: null,
    difficulty: null,
    roll: null,
    advantages: [],
    disadvantages: [],
    summary: "",
    costs: [],
    gains: [],
    revealedClues: [],
    changedSituation: "",
    preEvents: [],
    intervention: null,
    sceneTransition: null,
    actionNarration: "",
    npcLine: null,
    growth: [],
  };
}

function applyIntentEffects(state, action, resolution) {
  const outcome = resolution.outcome;
  const success = isSuccess(outcome);
  const costly = outcome === "costly_success";

  switch (action.intent) {
    case "investigate": {
      if (success || costly) {
        const clue = sceneClue(state.world.sceneId, state.clues);
        if (clue) addClue(state, clue, resolution);
        resolution.summary = success
          ? "눈에 띄지 않던 흔적의 순서와 의미를 짚어 냈다."
          : "단서를 찾았지만 누군가에게 움직임을 들켰다.";
        if (costly) changeAlert(state, 1, "조사 중 인기척을 냄", resolution);
      } else {
        resolution.summary = "흔적을 쫓는 동안 핵심 자국이 비에 씻겨 나갔다.";
        changeAlert(state, 1, "조사가 지연됨", resolution);
      }
      break;
    }
    case "talk": {
      const npcId = action.choice?.id === "question_boatman"
        ? "gang_mujin"
        : sceneNpc(state.world.sceneId);
      const npc = NPCS.find((candidate) => candidate.id === npcId);
      const delta = success ? (outcome === "strong_success" ? 2 : 1) : -1;
      changeRelation(state, npcId, "trust", delta, "대화의 결과", resolution);
      resolution.summary = success
        ? "상대는 말의 의도와 대가를 납득하고 아는 범위에서 답했다."
        : "상대는 질문의 속내를 의심하며 필요한 말만 남겼다.";
      if (success && npcId === "gang_mujin") {
        addClue(state, {
          id: "east_boat",
          text: "습격 직후 등불을 끈 배 한 척이 동쪽 갈대밭으로 향했다",
          source: "강무진의 목격",
          certainty: "증언",
        }, resolution);
      }
      resolution.npcLine = npcDialogue(npc, outcome, state.world.sceneId);
      break;
    }
    case "move": {
      if (success) {
        resolution.summary = "시야와 발소리를 계산해 먼저 유리한 길목을 잡았다.";
        resolution.gains.push("다음 위험에 대한 위치 우세");
      } else if (costly) {
        resolution.summary = "목표와의 거리는 좁혔지만 거친 지형에 몸을 부딪쳤다.";
        damagePlayer(state, 2, "무리한 이동", resolution);
      } else {
        resolution.summary = "상대의 동선을 놓치고 막다른 물길에 몰렸다.";
        damagePlayer(state, 2, "추격 실패", resolution);
        changeAlert(state, 1, "추적 대상이 경계함", resolution);
      }
      break;
    }
    case "train": {
      const qiCost = state.fatigue.repeatedIntent >= 2 ? 3 : 2;
      spendQi(state, qiCost, "수련", resolution);
      const gain = success ? 2 : 1;
      changeNumber(state, "player.progress.practice", gain, "의식적인 수련", resolution);
      resolution.summary = success
        ? "초식의 모양이 아니라 힘이 이어지는 순간을 붙잡았다."
        : "동작은 익숙해졌지만 호흡이 어긋나 내력에 탁기가 남았다.";
      if (!success) addCondition(state, "기혈 불균형", 2, resolution);
      break;
    }
    case "breakthrough": {
      spendQi(state, 4, "경지 돌파", resolution);
      if (success) {
        advanceRealm(state, resolution);
      } else {
        resolution.summary = "쌓아 온 조건은 충분했지만 호흡과 의념이 마지막 관문에서 어긋났다.";
        addCondition(state, outcome === "critical_failure" ? "내상" : "기혈 역류", outcome === "critical_failure" ? 5 : 3, resolution);
        resolution.costs.push("돌파 조건은 보존되지만 회복 전 재시도는 위험함");
      }
      break;
    }
    case "rest": {
      const recovered = Math.min(4, state.player.resources.maxHealth - state.player.resources.health);
      changeNumber(state, "player.resources.health", recovered, "휴식과 응급 처치", resolution);
      const qiRecovered = Math.min(3, state.player.resources.maxQi - state.player.resources.qi);
      changeNumber(state, "player.resources.qi", qiRecovered, "호흡 회복", resolution);
      tickConditions(state);
      resolution.summary = "안전한 틈을 골라 상처를 묶고 흐트러진 호흡을 가다듬었다.";
      if (state.world.alert > 0) changeAlert(state, 1, "휴식 중 적의 준비", resolution);
      break;
    }
    case "defend":
    case "combat": {
      startCombat(state, state.world.sceneId === "reed_warehouse" ? "warehouse_guard" : "dock_enforcer", resolution);
      resolveCombatTurn(state, action, resolution);
      break;
    }
    default: {
      if (success || costly) {
        resolution.summary = success
          ? "제안한 방법의 구체적인 부분이 상황에 맞아 새로운 틈을 만들었다."
          : "방법은 통했지만 예상한 위험 하나를 피하지 못했다.";
        if (costly) changeAlert(state, 1, "창의적 시도의 노출", resolution);
      } else {
        resolution.summary = "생각한 방법은 일부 조건을 놓쳐 목표에 닿지 못했다.";
        resolution.costs.push("시간이 흐르고 상대가 대응할 기회를 얻음");
      }
    }
  }
}

function applyChoiceEffects(state, action, resolution) {
  const id = action.choice?.id;
  if (!id) return;
  const positive = isSuccess(resolution.outcome) || resolution.outcome === "costly_success";

  if (id.startsWith("build:") && positive) {
    const [, pathId, branchId] = id.split(":");
    const branch = selectBuildBranch(state.player, pathId, branchId);
    if (branch) {
      resolution.summary = `${branch.name}의 이치를 택해 ${branch.technique.name}을 자신의 초식으로 받아들였다.`;
      resolution.gains.push(`빌드 확정: ${branch.name} · ${branch.title}`);
      resolution.growth.push(`${branch.technique.name} 습득`);
      state.player.growthLog.push({
        turn: state.turn,
        type: "branch",
        text: `${branch.name} 계통을 선택하고 ${branch.technique.name}을 깨달았다.`,
      });
    }
    return;
  }

  if (id === "treat_courier" && positive) {
    changeRelation(state, "seo_yeonhwa", "trust", 2, "먼저 부상을 돌봄", resolution);
    addClue(state, {
      id: "planned_ambush",
      text: "습격자는 약재 수레의 교대 시간과 호위 공백을 정확히 알고 있었다",
      source: "서연화의 증언",
      certainty: "증언",
    }, resolution);
    if (state.player.tenet === "keep_promise") {
      state.promises.push({ to: "seo_yeonhwa", text: "오늘 밤 전 약재를 되찾겠다", dueTurn: 6, status: "active" });
      resolution.gains.push("서연화와의 약속");
    }
  }

  if (id === "inspect_tracks" && positive) {
    addClue(state, {
      id: "black_salt_residue",
      text: "수레바퀴 안쪽에 이 지역 창고에서 쓰지 않는 검은 소금 가루가 묻어 있다",
      source: "현장 조사",
      certainty: "객관적 사실",
    }, resolution);
  }

  if (id === "question_boatman" && positive) {
    changeRelation(state, "gang_mujin", "trust", 1, "증언을 강요하지 않음", resolution);
    state.debts.push({ from: "gang_mujin", to: "player", reason: "아들의 기록을 성급히 공개하지 않음", value: 1 });
    resolution.gains.push("강무진의 작은 빚");
  }

  if (id === "chase_shadow" && !positive) {
    addCondition(state, "발목 타박", 3, resolution);
  }

  if (id === "rescue_workers" && positive) {
    changeNumber(state, "player.reputation.mercy", 2, "인부 구조를 우선함", resolution);
    state.delayedConsequences.push({
      id: `workers_testimony_${state.turn}`,
      cause: "창고 인부들을 먼저 구출함",
      target: "river_alliance",
      triggerTurn: state.turn + 2,
      expectedWindow: "2턴 뒤",
      effect: "workers_testimony",
      visibility: "public",
      triggered: false,
    });
    resolution.gains.push("살아 있는 증인");
  }

  if (id === "steal_ledger" && positive) {
    addClue(state, {
      id: "coded_ledger",
      text: "장부의 운송 경로가 수맥도와 같은 방식의 점선으로 표시되어 있다",
      source: "검은 소금 장부",
      certainty: "객관적 사실",
    }, resolution);
    state.delayedConsequences.push({
      id: `abandoned_workers_${state.turn}`,
      cause: "장부를 먼저 확보함",
      target: "baekro_people",
      triggerTurn: state.turn + 1,
      expectedWindow: "다음 주요 장면",
      effect: "workers_hurt",
      visibility: "hidden",
      triggered: false,
    });
  }

  if (id === "offer_deal" && positive) {
    if (state.combat) state.combat.enemy.morale = Math.max(0, state.combat.enemy.morale - 3);
    addClue(state, {
      id: "merchant_link",
      text: "창고지기는 만리상단의 푸른 봉인이 찍힌 지시서를 받았다",
      source: "창고지기의 거래 조건",
      certainty: "주장",
    }, resolution);
  }

  if (["report_office", "contact_crane", "sell_information", "leave_city"].includes(id) && positive) {
    resolveOpeningQuest(state, id, resolution);
  }
}

function updateQuestProgress(state, action, resolution) {
  const quest = state.quests.stolenMedicine;
  if (quest.status !== "active") return;
  if (["rest", "train"].includes(action.intent)) return;

  const deltaByOutcome = {
    strong_success: 22,
    success: 16,
    costly_success: 10,
    failure: 4,
    critical_failure: 2,
    automatic: 6,
  };
  let delta = deltaByOutcome[resolution.outcome] || 0;
  if (action.choice?.id === "chase_shadow" && isSuccess(resolution.outcome)) delta += 18;
  if (action.choice?.id === "steal_ledger" && isSuccess(resolution.outcome)) delta += 20;
  if (state.combat) delta = Math.min(delta, 8);

  const before = quest.progress;
  quest.progress = Math.min(100, quest.progress + delta);
  recordChange(state, {
    path: "quests.stolenMedicine.progress",
    before,
    after: quest.progress,
    cause: `${action.intent} 행동의 ${resolution.outcome}`,
    related: [state.world.sceneId],
    futureImpact: "장면 전환과 사건 해결 시점",
  });
  if (delta > 0) resolution.gains.push(`사건 진전 +${delta}`);
}

function applySceneTransition(state, action, resolution) {
  const progress = state.quests.stolenMedicine.progress;

  if (state.world.sceneId === "baekro_dock"
    && !state.combat
    && (progress >= 50 || (action.choice?.id === "chase_shadow" && isSuccess(resolution.outcome)))) {
    transitionTo(state, "reed_warehouse", resolution);
    return;
  }

  if (state.world.sceneId === "reed_warehouse"
    && !state.combat
    && (progress >= 82 || state.clues.some((clue) => clue.id === "coded_ledger"))) {
    transitionTo(state, "cheongryu_gate", resolution);
  }
}

function transitionTo(state, sceneId, resolution) {
  const before = state.world.sceneId;
  const scene = SCENES[sceneId];
  state.world.sceneId = sceneId;
  state.world.location = scene.location;
  state.world.sceneProgress = 0;
  resolution.sceneTransition = { from: before, to: sceneId };
  resolution.changedSituation = `${scene.location}의 새 목표가 열렸다: ${scene.objective}`;
  recordChange(state, {
    path: "world.sceneId",
    before,
    after: sceneId,
    cause: "충분한 단서와 사건 진전",
    related: [sceneId],
    futureImpact: scene.stakes,
  });
}

function resolveOpeningQuest(state, path, resolution) {
  const quest = state.quests.stolenMedicine;
  if (quest.status !== "active") return;
  const factionByPath = {
    report_office: "pacification_office",
    contact_crane: "white_crane",
    sell_information: "blue_gate",
    leave_city: "none",
  };
  const faction = factionByPath[path];
  quest.status = "completed";
  quest.progress = 100;
  quest.paths.push(path);
  state.goals.completed.push("도난당한 약재 사건의 첫 배후를 밝혀냈다");
  state.goals.active = state.goals.active.filter((goal) => !goal.includes("도난당한 약재"));
  state.goals.active.unshift("장부 속 수맥 표식과 인연패의 관계를 밝힌다");
  state.chapter = 2;

  if (faction !== "none") {
    changeFaction(state, faction, "standing", 2, "장부와 증거를 공유함", resolution);
    state.delayedConsequences.push({
      id: `chosen_faction_${state.turn}`,
      cause: `첫 증거를 ${faction}에 제공함`,
      target: faction,
      triggerTurn: state.turn + 3,
      expectedWindow: "다음 지역의 초반",
      effect: "faction_response",
      visibility: "public",
      triggered: false,
    });
  } else {
    state.factions.blue_gate.heat += 1;
    state.factions.pacification_office.heat += 1;
    resolution.costs.push("증거를 노리는 두 세력의 추적");
  }

  resolution.gains.push("2장 개방: 물길 아래의 지도");
  resolution.changedSituation = "첫 사건은 끝났지만 장부의 수맥 표식이 낡은 인연패와 정확히 맞아떨어진다.";
}

function startCombat(state, enemyId, resolution) {
  if (state.combat) return;
  const enemy = structuredClone(ENEMIES[enemyId]);
  state.combat = {
    round: 1,
    initiative: "contested",
    distance: enemyId === "warehouse_guard" ? "중거리" : "근거리",
    terrain: enemyId === "warehouse_guard" ? "기름통과 좁은 문" : "젖은 나무 난간과 운하",
    objective: enemyId === "warehouse_guard" ? "장부 또는 인부 확보" : "길을 열고 약재 단서 확보",
    enemy,
    observed: [enemy.clue],
    playerAdvantage: 0,
  };
  resolution.changedSituation = `${enemy.name}이 길을 막았다. 전멸이 아니라 ${state.combat.objective}가 전투 목표다.`;
  resolution.revealedClues.push(enemy.clue);
}

function resolveCombatTurn(state, action, resolution) {
  if (!state.combat) {
    startCombat(state, state.world.sceneId === "reed_warehouse" ? "warehouse_guard" : "dock_enforcer", resolution);
  }
  const combat = state.combat;
  const enemy = combat.enemy;
  const outcome = resolution.outcome;
  const strong = outcome === "strong_success";
  const success = isSuccess(outcome);
  const costly = outcome === "costly_success";

  if (action.intent === "talk") {
    const moraleLoss = strong ? 4 : success ? 3 : costly ? 1 : 0;
    enemy.morale = Math.max(0, enemy.morale - moraleLoss);
    resolution.summary = moraleLoss
      ? "상대가 지키는 대상과 버림받을 두려움을 짚자 공격의 망설임이 생겼다."
      : "상대는 말을 시간 끌기로 받아들이고 거리를 좁혔다.";
    if (!moraleLoss) damagePlayer(state, 2, "대화 중 압박", resolution);
  } else if (action.intent === "defend" || action.intent === "investigate") {
    if (success || costly) {
      combat.playerAdvantage = Math.min(2, combat.playerAdvantage + 1);
      state.player.resources.balance = Math.min(
        state.player.resources.maxBalance,
        state.player.resources.balance + 1,
      );
      resolution.summary = "공격을 흘리며 발과 시선의 반복을 읽어 다음 교환의 우세를 만들었다.";
      resolution.gains.push("다음 전투 판정 위치 우세");
      resolution.revealedClues.push(enemy.weakness);
      if (costly) damagePlayer(state, 1, "방어 중 스친 타격", resolution);
    } else {
      resolution.summary = "방어 방향을 읽힌 탓에 균형이 무너졌다.";
      damagePlayer(state, 3, "방어 실패", resolution);
      state.player.resources.balance = Math.max(0, state.player.resources.balance - 1);
    }
  } else if (action.intent === "move") {
    if (success) {
      resolution.summary = "난간과 시야의 사각을 이용해 교전권을 끊었다.";
      resolution.gains.push("전투 이탈 성공");
      state.combat = null;
      changeAlert(state, 1, "적이 추격 준비", resolution);
      return;
    }
    resolution.summary = costly
      ? "거리는 벌렸지만 등을 보인 순간 한 차례 타격을 허용했다."
      : "퇴로를 선점당해 다시 근거리로 끌려왔다.";
    damagePlayer(state, costly ? 2 : 4, "이탈 시도 실패", resolution);
  } else {
    const baseDamage = strong ? 5 : success ? 3 : costly ? 2 : 0;
    const advantageDamage = Math.min(2, combat.playerAdvantage);
    const damage = baseDamage + advantageDamage;
    combat.playerAdvantage = 0;
    spendQi(state, 1, "전투 초식", resolution);

    if (damage > 0) {
      enemy.health = Math.max(0, enemy.health - damage);
      enemy.morale = Math.max(0, enemy.morale - (strong ? 2 : 1));
      resolution.summary = strong
        ? "상대의 무게중심이 옮겨지는 순간을 잡아 초식을 정확히 꽂았다."
        : "공격이 방어를 비틀어 전투 목표에 한 걸음 다가갔다.";
      resolution.gains.push(`${enemy.name} 피해 ${damage}`);
      if (costly) damagePlayer(state, 2, "공격과 맞교환", resolution);
    } else {
      resolution.summary = "익숙한 공격 궤적을 읽혀 빈틈을 내주었다.";
      damagePlayer(state, outcome === "critical_failure" ? 5 : 3, "적의 반격", resolution);
      state.player.resources.balance = Math.max(0, state.player.resources.balance - 1);
    }
  }

  if (!state.combat) return;
  combat.round += 1;
  if (enemy.health <= 0 || enemy.morale <= 0) {
    const nonLethal = state.player.tenet === "no_kill" || !/(죽|목을|숨통)/.test(action.declaration);
    resolution.gains.push(nonLethal ? `${enemy.name} 비살상 제압` : `${enemy.name} 격파`);
    resolution.summary += nonLethal
      ? " 상대는 더 싸울 뜻을 잃고 무기를 놓았다."
      : " 상대는 더 이상 전투를 이어 가지 못한다.";
    state.combat = null;
    changeNumber(state, "player.progress.combatExperience", 2, "실전에서 전투 목표 달성", resolution);
    state.quests.stolenMedicine.progress = Math.min(100, state.quests.stolenMedicine.progress + 14);
  }

  if (state.player.resources.health <= 0) {
    state.player.resources.health = 1;
    addCondition(state, "깊은 타박상", 5, resolution);
    state.player.resources.coins = Math.max(0, state.player.resources.coins - 5);
    state.combat = null;
    resolution.outcome = "defeat_forward";
    resolution.summary = "의식을 잃었지만 죽지는 않았다. 약재 꾸러미 일부와 동전이 사라졌고, 적은 다음 움직임을 시작했다.";
    resolution.costs.push("깊은 타박상", "동전 5냥", "적 세력의 시간 우세");
    changeAlert(state, 2, "전투 패배", resolution);
  }
}

function addClue(state, clue, resolution) {
  if (state.clues.some((entry) => entry.id === clue.id)) return;
  state.clues.push({ ...clue, acquiredTurn: state.turn, status: "unconnected" });
  resolution.revealedClues.push(clue.text);
  resolution.gains.push(`단서: ${clue.text}`);
  state.facts.confirmed.push({ id: clue.id, text: clue.text, source: clue.source });
}

function sceneClue(sceneId, clues) {
  const ids = new Set(clues.map((clue) => clue.id));
  const pools = {
    baekro_dock: [
      { id: "rope_mark", text: "끊긴 밧줄은 칼이 아니라 안쪽에서 푼 흔적이다", source: "현장 조사", certainty: "객관적 사실" },
      { id: "black_salt_residue", text: "수레바퀴에 검은 소금 가루가 묻어 있다", source: "현장 조사", certainty: "객관적 사실" },
    ],
    reed_warehouse: [
      { id: "medicine_crates", text: "약재 상자 일부는 팔지 않고 따로 봉인되어 있다", source: "창고 조사", certainty: "객관적 사실" },
      { id: "double_seal", text: "상단 봉인 아래 수로맹의 위조 도장이 겹쳐 있다", source: "창고 조사", certainty: "객관적 사실" },
    ],
    cheongryu_gate: [
      { id: "token_match", text: "장부의 수맥 표식과 낡은 인연패의 문양이 일치한다", source: "대조 조사", certainty: "객관적 사실" },
    ],
  };
  return pools[sceneId]?.find((clue) => !ids.has(clue.id));
}

function sceneNpc(sceneId) {
  return {
    baekro_dock: "seo_yeonhwa",
    reed_warehouse: "mak_daeryong",
    cheongryu_gate: "jin_baegun",
  }[sceneId] || "seo_yeonhwa";
}

function damagePlayer(state, amount, cause, resolution) {
  const before = state.player.resources.health;
  state.player.resources.health = Math.max(0, before - amount);
  resolution.costs.push(`체력 -${amount}`);
  recordChange(state, {
    path: "player.resources.health",
    before,
    after: state.player.resources.health,
    cause,
    futureImpact: "부상과 판정 불리",
  });
}

function spendQi(state, amount, cause, resolution) {
  const before = state.player.resources.qi;
  state.player.resources.qi = Math.max(0, before - amount);
  if (amount) resolution.costs.push(`내력 -${amount}`);
  recordChange(state, {
    path: "player.resources.qi",
    before,
    after: state.player.resources.qi,
    cause,
    futureImpact: "무공 사용 여력 감소",
  });
}

function changeAlert(state, amount, cause, resolution) {
  const before = state.world.alert;
  state.world.alert = Math.max(0, Math.min(6, before + amount));
  if (amount > 0) resolution.costs.push(`적 경계 +${amount}`);
  recordChange(state, {
    path: "world.alert",
    before,
    after: state.world.alert,
    cause,
    futureImpact: "지원 도착과 난이도 상승",
  });
}

function changeRelation(state, npcId, axis, amount, cause, resolution) {
  if (!state.relationships[npcId]) {
    state.relationships[npcId] = { trust: 0, affection: 0, fear: 0, debt: 0, interest: 0, knownFacts: [] };
  }
  const relation = state.relationships[npcId];
  const before = relation[axis] || 0;
  relation[axis] = Math.max(-6, Math.min(6, before + amount));
  const npc = NPCS.find((entry) => entry.id === npcId);
  resolution[amount >= 0 ? "gains" : "costs"].push(`${npc?.name || npcId} ${axis} ${amount >= 0 ? "+" : ""}${amount}`);
  recordChange(state, {
    path: `relationships.${npcId}.${axis}`,
    before,
    after: relation[axis],
    cause,
    related: [npcId],
    futureImpact: "NPC의 협력·정보·배신 판단",
  });
}

function changeFaction(state, factionId, axis, amount, cause, resolution) {
  const faction = state.factions[factionId];
  const before = faction[axis];
  faction[axis] = Math.max(-6, Math.min(6, before + amount));
  resolution.gains.push(`${factionId} 관계 +${amount}`);
  recordChange(state, {
    path: `factions.${factionId}.${axis}`,
    before,
    after: faction[axis],
    cause,
    related: [factionId],
    futureImpact: "세력 사건과 지역 접근권",
  });
}

function changeNumber(state, path, amount, cause, resolution) {
  if (!amount) return;
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((value, key) => value[key], state);
  const before = target[last];
  target[last] += amount;
  resolution.gains.push(`${path} +${amount}`);
  recordChange(state, { path, before, after: target[last], cause });
}

function addCondition(state, name, duration, resolution) {
  const existing = state.player.conditions.find((condition) => condition.name === name);
  if (existing) existing.duration = Math.max(existing.duration, duration);
  else state.player.conditions.push({ name, severity: 1, duration });
  resolution.costs.push(`${name} (${duration}턴)`);
}

function tickConditions(state) {
  state.player.conditions = state.player.conditions
    .map((condition) => ({ ...condition, duration: condition.duration - 1 }))
    .filter((condition) => condition.duration > 0);
}

function spendTime(state, amount, resolution) {
  const before = state.player.resources.time;
  state.player.resources.time = Math.max(0, before - amount);
  resolution.costs.push(`시간 -${amount}`);
  if (state.player.resources.time === 0) {
    state.world.day += 1;
    state.world.period = "이른 아침";
    state.player.resources.time = 6;
    resolution.changedSituation = "해가 바뀌며 세력들의 계획도 한 단계 진행됐다.";
    for (const faction of Object.values(state.factions)) faction.clock += 1;
  }
}

function processDueConsequences(state) {
  const events = [];
  for (const consequence of state.delayedConsequences) {
    if (consequence.triggered || consequence.triggerTurn > state.turn) continue;
    consequence.triggered = true;
    if (consequence.effect === "workers_testimony") {
      state.factions.river_alliance.heat = Math.max(0, state.factions.river_alliance.heat - 1);
      events.push("구출된 인부들이 위조된 수로맹 도장을 증언했다.");
    } else if (consequence.effect === "workers_hurt") {
      state.player.reputation.mercy -= 1;
      events.push("뒤늦게 구출된 인부 하나가 크게 다쳤다는 소식이 퍼졌다.");
    } else if (consequence.effect === "faction_response") {
      state.factions[consequence.target].clock += 1;
      events.push("증거를 받은 세력이 독자적으로 다음 수를 두기 시작했다.");
    }
  }
  return events;
}

function runNpcPlans(state, resolution) {
  const clock = state.world.campaignClock;
  if (clock > 0 && clock % 3 === 0) {
    state.gm.secretClock += 1;
    const plan = state.gm.npcPlans.mak_daeryong;
    plan.step += 1;
    if (state.world.sceneId === "baekro_dock") {
      changeAlert(state, 1, "막대룡의 부하들이 증거를 치움", resolution);
      resolution.changedSituation ||= "플레이어가 머무는 동안에도 누군가는 증거를 치우고 있다.";
    }
  }
}

function updateFatigue(state, action, resolution, meaningfulChange) {
  const fatigue = state.fatigue;
  if (fatigue.lastIntent === action.intent) fatigue.repeatedIntent += 1;
  else fatigue.repeatedIntent = 0;
  fatigue.lastIntent = action.intent;
  fatigue.shortInputs = action.declaration.length <= 4 ? fatigue.shortInputs + 1 : 0;
  fatigue.passiveInputs = /^(계속|다음|좋아|네|응|ㅇㅇ|그렇게)$/i.test(action.declaration)
    ? fatigue.passiveInputs + 1
    : 0;
  fatigue.stagnantTurns = meaningfulChange ? 0 : fatigue.stagnantTurns + 1;

  const sceneType = SCENES[state.world.sceneId]?.type;
  const recentSameType = state.recentScenes.slice(-2).every((scene) => scene.type === sceneType)
    && state.recentScenes.length >= 2;
  fatigue.sameSceneType = recentSameType ? fatigue.sameSceneType + 1 : 0;
  fatigue.boredomScore = [
    fatigue.repeatedIntent >= 2,
    fatigue.shortInputs >= 2,
    fatigue.passiveInputs >= 2,
    fatigue.stagnantTurns >= 2,
    fatigue.sameSceneType >= 1,
  ].filter(Boolean).length;

  if (resolution.outcome === "impossible") fatigue.stagnantTurns += 1;
}

function maybeInterveneForBoredom(state, resolution) {
  if (state.fatigue.boredomScore < 2) return;

  let intervention;
  if (state.combat) {
    state.combat.terrain += ", 등잔이 쓰러져 시야가 갈라짐";
    intervention = "같은 수법을 읽은 적이 거리를 바꾸는 순간, 쓰러진 등잔이 전장을 둘로 갈라 새 선택이 생겼다.";
  } else if (state.world.sceneId === "baekro_dock") {
    addClue(state, {
      id: "independent_npc_move",
      text: "서연화가 기다리지 않고 피 묻은 약갑 하나를 들고 동쪽 물길로 향했다",
      source: "NPC의 독립 행동",
      certainty: "객관적 사실",
    }, resolution);
    intervention = "서연화가 스스로 움직여 장소와 목표가 바뀔 조짐을 만들었다.";
  } else {
    intervention = "멀리서 순무영의 징 소리가 들린다. 경쟁 세력이 도착하기 전에 선택해야 한다.";
    changeAlert(state, 1, "정체 감지 후 시간 압박", resolution);
  }

  resolution.intervention = intervention;
  state.fatigue.lastIntervention = { turn: state.turn, text: intervention };
  state.fatigue.stagnantTurns = 0;
  state.fatigue.boredomScore = 0;
}

function recordScene(state, action, resolution) {
  const scene = SCENES[state.world.sceneId] || SCENES.baekro_dock;
  state.recentScenes.push({
    turn: state.turn,
    type: state.combat ? "전투" : scene.type,
    location: state.world.location,
    opponent: state.combat?.enemy?.id || null,
    objective: state.combat?.objective || scene.objective,
    reward: resolution.gains[0] || "상황 진전",
    emotion: emotionForOutcome(resolution.outcome),
    method: action.intent,
  });
  if (state.recentScenes.length > 12) state.recentScenes = state.recentScenes.slice(-12);
}

function emotionForOutcome(outcome) {
  return {
    strong_success: "통쾌함",
    success: "확신",
    costly_success: "긴장",
    failure: "압박",
    critical_failure: "위기",
    defeat_forward: "회복 의지",
  }[outcome] || "호기심";
}

function contextualChoices(state) {
  const buildChoices = getBranchChoiceOptions(state.player);
  if (state.combat) {
    const enemy = state.combat.enemy;
    const branch = state.player.martialArts.find((art) => art.branch)?.branch;
    const attackLabel = branch
      ? `${branch.name}의 장기를 살려 ${enemy.name}의 ${enemy.weakness}을 파고든다`
      : `관찰한 약점인 ‘${enemy.weakness}’을 노려 주도권을 잡는다`;
    const guardLabel = state.player.resources.balance <= 2
      ? "무너진 균형을 회복하며 다음 공격의 궤적을 읽는다"
      : `공격을 흘리며 ${enemy.tactic}에 대응할 틈을 찾는다`;
    return [
      { id: "combat_press", label: attackLabel, intent: "combat", risk: branch?.tradeoff || "반격" },
      { id: "combat_guard", label: guardLabel, intent: "defend", risk: "전투가 길어짐" },
      { id: "combat_talk", label: `${enemy.name}이 두려워하는 ‘${enemy.fear}’을 건드려 항복을 유도한다`, intent: "talk", risk: "속내를 잘못 읽음" },
      { id: "combat_escape", label: `${state.combat.terrain}을 이용해 교전 거리를 끊는다`, intent: "move", risk: "추격을 허용함" },
    ];
  }

  const scene = SCENES[state.world.sceneId] || SCENES.baekro_dock;
  const suggestions = [...buildChoices];
  const context = state.context || {};
  const newestClue = context.newestClues?.at(-1) || state.clues.at(-1)?.text;

  if (newestClue) {
    suggestions.push({
      id: "context:follow_clue",
      label: `방금 확인한 ‘${shorten(newestClue, 34)}’을 다른 흔적과 대조한다`,
      intent: "investigate",
      risk: "한 단서에 시야가 좁아질 수 있음",
      contextual: true,
    });
  }
  if (["failure", "critical_failure"].includes(context.lastOutcome)) {
    suggestions.push({
      id: "context:change_method",
      label: "방금 실패한 수법을 버리고 주변 인물의 도움과 다른 접근을 찾는다",
      intent: "talk",
      risk: "도움을 청한 사실이 알려짐",
      contextual: true,
    });
  }
  if (state.world.alert > 0) {
    suggestions.push({
      id: "context:lower_alert",
      label: "추적을 멈추고 시선을 돌릴 거짓 흔적을 남긴다",
      intent: "creative",
      risk: "시간이 흐름",
      contextual: true,
    });
  }

  const adapted = scene.choices
    .filter((choice) => choice.id !== context.lastChoiceId)
    .filter((choice) => !(context.lastIntent === choice.intent && state.fatigue.repeatedIntent >= 1))
    .map((choice) => adaptSceneChoice(state, choice));
  suggestions.push(...adapted);

  if (suggestions.length < 3) {
    suggestions.push(...scene.choices.map((choice) => adaptSceneChoice(state, choice)));
  }

  const unique = [];
  const ids = new Set();
  for (const choice of suggestions) {
    if (!ids.has(choice.id)) {
      unique.push(choice);
      ids.add(choice.id);
    }
  }
  return unique.slice(0, 5);
}

function adaptSceneChoice(state, choice) {
  const labels = {
    treat_courier: state.relationships.seo_yeonhwa.trust > 0
      ? "서연화에게 치료를 이어 가며 습격자가 알던 교대 정보를 묻는다"
      : "서연화의 상처부터 살피며 그녀가 직접 본 장면을 차분히 듣는다",
    inspect_tracks: state.clues.some((clue) => clue.id === "black_salt_residue")
      ? "검은 소금 가루와 수레바퀴 홈을 대조해 출발한 창고를 좁힌다"
      : "빗물에 지워지기 전 수레와 진흙 자국의 선후를 조사한다",
    question_boatman: state.clues.some((clue) => clue.id === "east_boat")
      ? "강무진이 본 등불 꺼진 배의 선주와 물길을 확인한다"
      : "강무진에게 소문이 아닌 자신이 직접 본 물길만 말해 달라고 청한다",
    chase_shadow: state.world.alert > 0
      ? "이미 경계한 검은 그림자의 퇴로를 예측해 우회 추적한다"
      : "지붕 위 그림자의 발 디딜 곳을 읽어 안전한 길로 추적한다",
    rescue_workers: "창고의 출입구를 막기 전에 갇힌 인부들의 위치와 수를 확인한다",
    steal_ledger: state.clues.length >= 2
      ? "확보한 단서와 맞는 장부 상자만 골라 조용히 빼낸다"
      : "경비의 시선이 인부에게 향한 틈에 장부 상자를 확인한다",
    challenge_guard: "창고 밖의 넓은 곳으로 경비를 유인해 장봉의 거리 이점을 없앤다",
    offer_deal: "고용주가 장부와 함께 그를 버릴 것이라는 증거를 보여 거래를 제안한다",
    report_office: "확정된 사실과 증언을 구분한 사본만 순무영에 넘긴다",
    contact_crane: "진백운에게 백학문의 이름이 얽힌 부분만 먼저 확인시킨다",
    sell_information: "청문각에 원본이 아닌 일부 표식을 보여 더 큰 배후와 교환한다",
    leave_city: "증거를 숨긴 채 추적을 따돌릴 수 있는 다음 지역과 동행을 구한다",
  };
  return { ...choice, label: labels[choice.id] || choice.label, contextual: true };
}

function applyGrowthProgress(state, action, resolution) {
  if (["impossible", "automatic"].includes(resolution.outcome)) return;
  const art = state.player.martialArts[0];
  const beforeMastery = art.mastery;
  let masteryGain = 0;
  const successGain = resolution.outcome === "strong_success" ? 3
    : resolution.outcome === "success" ? 2
      : resolution.outcome === "costly_success" ? 1
        : 0;

  if (action.intent === "train") masteryGain = Math.max(1, successGain + 1);
  if (["combat", "defend"].includes(action.intent)) masteryGain = successGain;
  if (art.id === "swallow_step" && action.intent === "move") masteryGain = Math.max(masteryGain, successGain);
  if (art.id === "healing_needles" && ["investigate", "rest"].includes(action.intent)) masteryGain = Math.max(masteryGain, successGain);
  if (art.id === "flowing_sword" && action.intent === "investigate" && successGain > 1) masteryGain = 1;

  if (masteryGain > 0) {
    art.mastery += masteryGain;
    resolution.growth.push(`${art.name} 숙련 +${masteryGain}`);
    recordChange(state, {
      path: `player.martialArts.${art.id}.mastery`,
      before: beforeMastery,
      after: art.mastery,
      cause: `${action.intent}에서 무공 원리를 실제로 사용함`,
      related: [art.id],
      futureImpact: "무공 분기와 경지 돌파 조건",
    });
  }

  if (resolution.outcome === "strong_success" && action.intent !== "rest") {
    const beforeInsight = state.player.progress.insight;
    state.player.progress.insight += 1;
    art.insight += 1;
    resolution.growth.push("깨달음 +1");
    recordChange(state, {
      path: "player.progress.insight",
      before: beforeInsight,
      after: state.player.progress.insight,
      cause: "상황과 무공의 원리를 예상보다 깊게 연결함",
      related: [action.intent, art.id],
      futureImpact: "경지 돌파와 새 초식 연구",
    });
  }

  if (["combat", "defend"].includes(action.intent)
    && ["strong_success", "success", "costly_success"].includes(resolution.outcome)) {
    changeNumber(state, "player.progress.combatExperience", 1, "실전 교환을 끝까지 경험함", resolution);
  }

  const conditionedBody = Math.min(9, 1 + Math.floor(state.player.progress.practice / 8));
  if (conditionedBody > state.player.progress.bodyCondition) {
    const before = state.player.progress.bodyCondition;
    state.player.progress.bodyCondition = conditionedBody;
    resolution.growth.push(`신체 준비 ${conditionedBody}단계`);
    recordChange(state, {
      path: "player.progress.bodyCondition",
      before,
      after: conditionedBody,
      cause: "누적 수련을 무리 없이 소화함",
      related: [art.id],
      futureImpact: "상위 경지 돌파 조건",
    });
  }

  const branchWasAvailable = art.availableBranches?.length > 0;
  refreshGrowth(state.player);
  if (!branchWasAvailable && art.availableBranches.length > 0) {
    resolution.growth.push(`${art.name}의 첫 빌드 분기 개방`);
    state.player.growthLog.push({
      turn: state.turn,
      type: "choice",
      text: `${art.name}을 서로 다른 방식으로 발전시킬 수 있게 되었다.`,
    });
  }
  for (const text of resolution.growth) {
    if (!state.player.growthLog.some((entry) => entry.turn === state.turn && entry.text === text)) {
      state.player.growthLog.push({ turn: state.turn, type: "progress", text });
    }
  }
  state.player.growthLog = state.player.growthLog.slice(-30);
}

function advanceRealm(state, resolution) {
  const currentIndex = state.player.realm.index;
  const nextRealm = REALM_LADDER[currentIndex + 1];
  if (!nextRealm) return;
  const before = state.player.realm.name;
  state.player.realm.index = currentIndex + 1;
  state.player.resources.maxHealth += 2;
  state.player.resources.health = Math.min(state.player.resources.maxHealth, state.player.resources.health + 2);
  state.player.resources.maxQi += 2;
  state.player.resources.qi = Math.min(state.player.resources.maxQi, state.player.resources.qi + 2);
  refreshGrowth(state.player);
  resolution.summary = `흩어져 있던 수련과 실전의 깨달음이 하나로 이어지며 ${nextRealm.name}의 문턱을 넘었다.`;
  resolution.gains.push(`경지 상승: ${before} → ${nextRealm.name}`, "최대 체력 +2", "최대 내력 +2");
  resolution.growth.push(`${nextRealm.name} 경지 도달`);
  state.player.growthLog.push({
    turn: state.turn,
    type: "realm",
    text: `${before}에서 ${nextRealm.name}으로 경지가 올랐다.`,
  });
  recordChange(state, {
    path: "player.realm.name",
    before,
    after: nextRealm.name,
    cause: "숙련·수련·실전·깨달음·신체 조건을 충족한 돌파",
    related: [state.player.martialArts[0].id],
    futureImpact: "상위 무공과 더 위험한 지역에 접근 가능",
  });
}

function describePlayerAction(state, action, resolution) {
  const name = state.player.name;
  const declaration = cleanInline(action.declaration);
  const topicParticle = hasFinalConsonant(name) ? "은" : "는";
  const declarationSentence = /[.!?]$/.test(declaration) ? declaration : `${declaration}.`;
  const methods = {
    investigate: "눈에 보이는 흔적만 훑지 않고 순서와 어긋난 부분을 비교하며, 누가 무엇을 숨기려 했는지까지 좁혀 간다.",
    talk: "상대가 직접 본 사실과 전해 들은 소문을 구분하도록 질문의 순서를 고르고, 표정과 망설임도 함께 살핀다.",
    combat: "무작정 힘을 겨루지 않고 거리와 발의 방향을 재어 자신의 초식을 펼칠 순간을 만든다.",
    defend: "공격을 막는 데 그치지 않고 충격을 흘리면서 상대의 반복되는 버릇과 다음 빈틈을 읽는다.",
    move: "가장 짧은 길보다 시야와 퇴로가 남는 동선을 택하고, 추적당할 경우의 이탈 지점까지 계산한다.",
    train: "동작의 횟수보다 호흡과 힘이 이어지는 순간에 집중하고, 몸이 보내는 이상 신호가 오면 즉시 흐름을 조절한다.",
    breakthrough: "지금까지 쌓은 숙련과 실전의 기억을 한 호흡에 모아 막힌 기혈과 의념의 경계를 밀어낸다.",
    rest: "상처와 호흡을 먼저 점검하고, 주변의 경계가 느슨해지지 않도록 짧고 안전한 회복만 취한다.",
    creative: "주변 환경과 인물의 반응을 도구로 삼되, 한 번 실패해도 물러날 수 있는 여지를 남긴다.",
    status: "성급히 움직이지 않고 몸 상태와 확보한 정보, 남은 시간과 위험을 차례로 확인한다.",
  };
  const leverage = resolution.advantages.length
    ? `특히 ${resolution.advantages.join(", ")}을 활용해 성공 가능성을 높인다.`
    : "성과가 보장된 행동은 아니므로 상대의 반응에 따라 즉시 방법을 바꿀 준비도 한다.";
  const risk = action.choice?.risk || resolution.disadvantages.at(0);
  const riskText = risk
    ? `그 과정에서 ${cleanInline(risk)}의 위험을 감수하지만, 목표를 놓치지 않는 범위에서만 밀어붙인다.`
    : "필요 이상의 위험은 만들지 않고 다음 행동에 쓸 힘과 정보를 남긴다.";
  return `${name}${topicParticle} 행동의 목표와 순서를 분명히 정한다. ${declarationSentence} ${methods[action.intent] || methods.creative} ${leverage} ${riskText}`;
}

function npcDialogue(npc, outcome) {
  if (!npc) return null;
  const failed = outcome === "failure" || outcome === "critical_failure";
  const lines = {
    seo_yeonhwa: failed
      ? "“확실한 것만 묻죠. 제가 보지 못한 일을 답하라면, 그건 진술이 아니라 추측이에요.”"
      : "“수레는 비가 오기 전에 멈췄어요. 상처보다 약재가 먼저입니다. 환자들은 밤을 기다려 주지 않아요.”",
    gang_mujin: failed
      ? "“강물도 몰아세우면 흙탕물만 일지. 오늘은 여기까지만 듣게.”"
      : "“등불을 끈 배는 물살을 거슬렀네. 떳떳한 사공이라면 그런 길을 고르지 않아.”",
    mak_daeryong: failed
      ? "“웃는 얼굴이라고 값을 깎아 줄 것 같나? 자네 패를 먼저 보여.”"
      : "“내 사람의 품삯과 목숨을 보장한다면, 장부를 지킬 이유도 달라지지.”",
    jin_baegun: failed
      ? "“주장과 증거를 섞지 마시오. 다시 정리한 뒤 찾아오시오.”"
      : "“문파의 이름보다 무고한 사람의 목숨이 먼저요. 확인할 수 있는 사실부터 주시오.”",
  };
  return lines[npc.id] || `“${npc.line}.” ${npc.name}은 그 원칙만은 분명히 했다.`;
}

function growthLabel(key) {
  return {
    mastery: "주력 무공 숙련",
    practice: "수련 축적",
    combatExperience: "실전 경험",
    insight: "깨달음",
    bodyCondition: "신체 준비",
  }[key] || key;
}

function shorten(value, length) {
  const clean = cleanInline(value);
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

function cleanInline(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasFinalConsonant(value) {
  const lastCharacter = [...String(value).trim()].at(-1);
  if (!lastCharacter) return false;
  const codePoint = lastCharacter.codePointAt(0);
  return codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 !== 0;
}

function relationTotal(state) {
  return Object.values(state.relationships).reduce(
    (sum, relation) => sum + relation.trust + relation.affection + relation.fear + relation.debt,
    0,
  );
}

function isSuccess(outcome) {
  return outcome === "strong_success" || outcome === "success";
}

function publicResolution(resolution) {
  return {
    intent: resolution.intent,
    outcome: resolution.outcome,
    difficulty: resolution.difficulty,
    roll: resolution.roll,
    advantages: resolution.advantages,
    disadvantages: resolution.disadvantages,
    summary: resolution.summary,
    costs: resolution.costs,
    gains: resolution.gains,
    revealedClues: resolution.revealedClues,
    changedSituation: resolution.changedSituation,
    preEvents: resolution.preEvents,
    intervention: resolution.intervention,
    sceneTransition: resolution.sceneTransition,
    actionNarration: resolution.actionNarration,
    npcLine: resolution.npcLine,
    growth: resolution.growth,
  };
}

