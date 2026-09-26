import { FACTIONS, NPCS, findOption } from "./content.js";

export const SCENE_NPCS = {
  baekro_dock: ["seo_yeonhwa", "gang_mujin"],
  reed_warehouse: ["mak_daeryong"],
  cheongryu_gate: ["jin_baegun"],
};

export const RELATION_LABELS = { trust: "신뢰", affection: "호의", fear: "두려움", debt: "은혜", interest: "이해관계" };

export function meetSceneNpcs(state) {
  for (const id of SCENE_NPCS[state.world.sceneId] || []) {
    state.relationships[id] ||= { trust: 0, affection: 0, fear: 0, debt: 0, interest: 0, knownFacts: [] };
    const relation = state.relationships[id];
    relation.met = true;
    relation.firstMetTurn ??= state.turn;
    relation.firstMetAt ||= state.world.location;
  }
}

export function startingBond(state) {
  const bond = findOption("bonds", state.player.bond);
  return { id: bond.id, name: bond.name, description: bond.description,
    status: { missing_sibling: "아직 행방을 찾지 못함", herbalist_debt: "내가 갚아야 할 은혜", retired_guard: "가르침을 받은 사제의 인연" }[bond.id] };
}

export function publicRelations(state) {
  return Object.fromEntries(Object.entries(state.relationships)
    .filter(([, value]) => value.met)
    .map(([id, value]) => {
      const npc = NPCS.find((entry) => entry.id === id);
      return [id, {
        name: npc?.name || id, role: npc?.role || "", stage: relationStage(value),
        trust: value.trust, affection: value.affection, fear: value.fear, debt: value.debt, interest: value.interest,
        firstMetAt: value.firstMetAt,
        description: relationDescription(value),
        recentEvents: (value.events || []).slice(-3).reverse().map((event) => ({ ...event })),
        obligations: state.promises.filter((promise) => promise.to === id && promise.status === "active")
          .map((promise) => `내가 한 약속: ${promise.text}`),
      }];
    }));
}

function relationStage(value) {
  if (value.trust <= -3) return "불신하는 사이";
  if (value.fear >= 3) return value.trust > 0 ? "신뢰와 두려움이 얽힌 사이" : "두려워하며 거리를 두는 사이";
  if (value.trust >= 5) return "깊이 신뢰하는 사이";
  if (value.trust >= 3) return "믿고 협력하는 사이";
  if (value.trust > 0) return "조심스럽게 마음을 여는 사이";
  if (value.trust < 0) return "서로를 경계하는 사이";
  if (value.affection > 0) return "호의를 보이는 사이";
  return "아직 서로를 알아가는 사이";
}

function relationDescription(value) {
  const parts = [value.trust >= 3 ? "말을 믿고 협력할 만한 사람으로 여긴다."
    : value.trust > 0 ? "이번 일을 함께 풀어 볼 여지는 열어 두었다."
      : value.trust < 0 ? "말을 곧이곧대로 믿지 않고 의도를 살핀다."
        : "아직 믿음이나 불신을 정할 만큼 겪은 일이 없다."];
  if (value.affection > 0) parts.push("일의 이해득실과 별개로 개인적인 호의도 있다.");
  if (value.affection < 0) parts.push("개인적인 감정에는 불편함이 남아 있다.");
  if (value.fear > 0) parts.push("느끼는 두려움 때문에 선뜻 다가서지는 못한다.");
  if (value.debt > 0) parts.push("상대가 내게 갚아야 할 은혜가 남아 있다.");
  if (value.debt < 0) parts.push("내가 상대에게 갚아야 할 은혜가 남아 있다.");
  if (value.interest > 0) parts.push("당장의 이해관계가 맞아 협력할 이유가 있다.");
  if (value.interest < 0) parts.push("서로의 이해관계가 엇갈린다.");
  return parts.join(" ");
}

// A reputation event has a concrete audience. No automatic worldwide propagation.
export function recordReputation(state, event) {
  state.reputationEvents ||= [];
  if (state.reputationEvents.some((entry) => entry.id === event.id)) return false;
  state.reputationEvents.push({ ...event, turn: state.turn });
  state.player.reputation[event.axis] += event.amount;
  return true;
}

export function publicReputation(state) {
  const events = state.reputationEvents || [];
  return {
    summary: events.length ? "행적을 직접 보거나 전해 들은 이들 사이에서만 이름이 오르내린다." : "아직 강호에 알려진 행적이 없다.",
    events: events.slice(-8).reverse().map((event) => ({ ...event })),
    factions: Object.entries(state.factions)
      .filter(([, value]) => value.standing || value.heat)
      .map(([id, value]) => ({
        id, name: FACTIONS.find((faction) => faction.id === id)?.name || id,
        description: [value.standing > 0 ? "협력할 명분이 생겼다." : value.standing < 0 ? "협력을 꺼리고 있다." : "협력 관계는 아직 없다.",
          value.heat > 0 ? "동향을 주시하고 있다." : ""].filter(Boolean).join(" "),
        cause: [...state.history].reverse().find((entry) => entry.path.startsWith(`factions.${id}.`) && entry.visibility === "public")?.cause || "증거의 행방을 둘러싼 이해관계",
      })),
  };
}
