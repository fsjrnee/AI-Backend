export const REALM_LADDER = [
  {
    id: "third_rate",
    name: "삼류",
    description: "호흡과 초식을 실전에서 잇기 시작한 무인",
    requirementsToNext: { mastery: 10, practice: 4, combatExperience: 1, insight: 1, bodyCondition: 1 },
  },
  {
    id: "second_rate",
    name: "이류",
    description: "한 계통의 무공을 흔들림 없이 운용하는 무인",
    requirementsToNext: { mastery: 24, practice: 10, combatExperience: 3, insight: 3, bodyCondition: 2 },
  },
  {
    id: "first_rate",
    name: "일류",
    description: "자신만의 전투 리듬과 명확한 장기를 갖춘 고수",
    requirementsToNext: { mastery: 42, practice: 18, combatExperience: 7, insight: 6, bodyCondition: 3 },
  },
  {
    id: "peak",
    name: "절정",
    description: "기와 초식이 의도만으로 이어지는 경지",
    requirementsToNext: { mastery: 65, practice: 30, combatExperience: 12, insight: 10, bodyCondition: 4 },
  },
  {
    id: "transcendent_peak",
    name: "초절정",
    description: "기존 무학의 틀을 벗어나 자기 해석을 세우는 경지",
    requirementsToNext: { mastery: 92, practice: 45, combatExperience: 20, insight: 16, bodyCondition: 5 },
  },
  {
    id: "transformation",
    name: "화경",
    description: "몸과 기의 경계가 흐려지고 자연스러운 변화가 가능한 경지",
    requirementsToNext: { mastery: 125, practice: 65, combatExperience: 30, insight: 24, bodyCondition: 6 },
  },
  {
    id: "profound",
    name: "현경",
    description: "무학의 이치를 현상 너머에서 이해하는 경지",
    requirementsToNext: { mastery: 165, practice: 90, combatExperience: 44, insight: 34, bodyCondition: 7 },
  },
  {
    id: "life_and_death",
    name: "생사경",
    description: "생사와 기혈의 흐름을 의지로 건드리는 전설의 경지",
    requirementsToNext: { mastery: 215, practice: 125, combatExperience: 60, insight: 48, bodyCondition: 8 },
  },
  {
    id: "harmony",
    name: "조화경",
    description: "자신과 천지의 흐름을 하나의 무학으로 완성한 경지",
    requirementsToNext: null,
  },
];

export const MARTIAL_DEFINITIONS = {
  flowing_sword: {
    name: "유수검",
    category: "검법",
    principle: "흐름을 끊지 않고 상대의 힘을 다음 초식으로 되돌린다.",
    tradeoff: "연계와 반격에 강하지만 좁은 공간과 중갑을 상대로 힘이 분산된다.",
    starterTechnique: { id: "flowing_first_ripple", name: "초수일파", description: "검로를 짧게 흘려 상대의 첫 반응을 읽는다." },
    branches: [
      {
        id: "returning_current",
        name: "회류",
        title: "반격과 관찰",
        description: "방어에서 얻은 정보를 다음 일격으로 돌려보낸다.",
        technique: { id: "returning_moon", name: "회류반월", description: "공격을 비껴 흘린 직후 반월의 검로로 되받는다." },
        bonusIntents: ["defend", "investigate"],
        penaltyIntents: ["combat"],
        tradeoff: "준비된 반격은 강하지만 먼저 몰아붙이는 공격은 위력이 낮다.",
      },
      {
        id: "rushing_current",
        name: "격류",
        title: "속공과 압박",
        description: "짧은 연격으로 상대가 자세를 회복할 틈을 없앤다.",
        technique: { id: "three_rushing_waves", name: "삼첩격랑", description: "세 번의 검격을 한 호흡으로 겹쳐 균형을 무너뜨린다." },
        bonusIntents: ["combat", "move"],
        penaltyIntents: ["defend"],
        tradeoff: "주도권을 잡기 쉽지만 공격이 막히면 균형과 내력 손실이 크다.",
      },
    ],
  },
  stone_fist: {
    name: "반석권",
    category: "권법·외공",
    principle: "발밑의 균형을 힘으로 바꾸어 짧은 거리에서 상대를 제압한다.",
    tradeoff: "균형과 제압에 강하지만 사거리가 짧고 추격전에 불리하다.",
    starterTechnique: { id: "rooted_palm", name: "입암장", description: "발을 뿌리내려 밀려나지 않고 장력을 전달한다." },
    branches: [
      {
        id: "iron_wall",
        name: "철벽",
        title: "수비와 비살상 제압",
        description: "충격을 받아 내며 상대의 관절과 중심을 묶는다.",
        technique: { id: "iron_gate", name: "철문쇄", description: "몸으로 길목을 봉쇄하고 상대의 움직임을 잠근다." },
        bonusIntents: ["defend", "talk"],
        penaltyIntents: ["move"],
        tradeoff: "정면 방어는 단단하지만 빠른 이탈과 추격에는 불리하다.",
      },
      {
        id: "crushing_rock",
        name: "쇄암",
        title: "파괴와 돌파",
        description: "한 점에 체중과 외공을 모아 방어 자체를 부순다.",
        technique: { id: "falling_boulder", name: "낙석붕", description: "짧은 보법 뒤 전신의 무게를 한 권에 싣는다." },
        bonusIntents: ["combat", "creative"],
        penaltyIntents: ["defend"],
        tradeoff: "파괴력은 높지만 빗나가면 자세가 크게 열린다.",
      },
    ],
  },
  swallow_step: {
    name: "비연보",
    category: "경공",
    principle: "선과 점이 아니라 다음에 유리할 자리를 먼저 차지한다.",
    tradeoff: "거리와 지형 장악에 강하지만 직접적인 타격 능력은 낮다.",
    starterTechnique: { id: "swallow_skims", name: "연자초수", description: "발끝의 힘을 죽여 젖은 지면도 짧게 미끄러진다." },
    branches: [
      {
        id: "afterimage",
        name: "잔영",
        title: "회피와 교란",
        description: "상대의 시선을 거짓 동선에 묶어 안전한 틈을 만든다.",
        technique: { id: "three_shadows", name: "삼영환위", description: "세 방향의 잔상을 남기며 사각으로 빠진다." },
        bonusIntents: ["defend", "move"],
        penaltyIntents: ["combat"],
        tradeoff: "생존과 이탈은 뛰어나지만 정면 화력이 부족하다.",
      },
      {
        id: "pursuing_star",
        name: "추성",
        title: "추격과 선점",
        description: "도주로와 지름길을 계산해 목표보다 먼저 도착한다.",
        technique: { id: "star_crossing", name: "추성월보", description: "벽과 난간을 연속으로 밟아 긴 거리를 단숨에 좁힌다." },
        bonusIntents: ["move", "investigate"],
        penaltyIntents: ["defend"],
        tradeoff: "추격에는 강하지만 방향을 바꿀 여유가 적어 함정에 취약하다.",
      },
    ],
  },
  healing_needles: {
    name: "청맥침법",
    category: "의술·암기",
    principle: "맥과 혈도를 읽어 죽이지 않고 몸의 흐름을 바꾼다.",
    tradeoff: "치료와 비살상 제압에 유용하지만 준비와 정확한 관찰이 필요하다.",
    starterTechnique: { id: "clear_meridian", name: "청맥일침", description: "한 개의 혈을 바로잡아 통증과 기혈의 막힘을 낮춘다." },
    branches: [
      {
        id: "living_meridian",
        name: "활맥",
        title: "치료와 지원",
        description: "상처와 내상의 원인을 읽고 회복의 흐름을 만든다.",
        technique: { id: "five_vital_needles", name: "오생침", description: "다섯 혈을 이어 급한 출혈과 내력 역류를 누그러뜨린다." },
        bonusIntents: ["rest", "talk"],
        penaltyIntents: ["combat"],
        tradeoff: "동료를 살리는 힘은 뛰어나지만 즉각적인 공격력이 낮다.",
      },
      {
        id: "sealed_meridian",
        name: "봉혈",
        title: "제압과 약점 공략",
        description: "관찰한 혈도에 침을 꽂아 움직임과 내력 운용을 제한한다.",
        technique: { id: "seven_locks", name: "칠성쇄맥", description: "연속된 일곱 혈을 노려 팔다리와 내력의 흐름을 봉한다." },
        bonusIntents: ["investigate", "combat"],
        penaltyIntents: ["move"],
        tradeoff: "정확히 맞히면 강자를 제압하지만 관찰 없이 쓰면 효과가 거의 없다.",
      },
    ],
  },
};

export function createMartialProgress(pathId) {
  const definition = MARTIAL_DEFINITIONS[pathId] || MARTIAL_DEFINITIONS.flowing_sword;
  return {
    id: pathId in MARTIAL_DEFINITIONS ? pathId : "flowing_sword",
    name: definition.name,
    category: definition.category,
    mastery: 2,
    insight: 0,
    level: "입문",
    principle: definition.principle,
    tradeoff: definition.tradeoff,
    branch: null,
    techniques: [{ ...definition.starterTechnique, unlockedAt: 0 }],
  };
}

export function getRealmSnapshot(index, progress, martialArts) {
  const safeIndex = Math.max(0, Math.min(index, REALM_LADDER.length - 1));
  const realm = REALM_LADDER[safeIndex];
  const mastery = Math.max(...martialArts.map((art) => art.mastery), 0);
  const requirements = realm.requirementsToNext;
  const readiness = requirements && {
    mastery: { current: mastery, required: requirements.mastery, met: mastery >= requirements.mastery },
    practice: { current: progress.practice, required: requirements.practice, met: progress.practice >= requirements.practice },
    combatExperience: { current: progress.combatExperience, required: requirements.combatExperience, met: progress.combatExperience >= requirements.combatExperience },
    insight: { current: progress.insight, required: requirements.insight, met: progress.insight >= requirements.insight },
    bodyCondition: { current: progress.bodyCondition, required: requirements.bodyCondition, met: progress.bodyCondition >= requirements.bodyCondition },
  };

  return {
    id: realm.id,
    name: realm.name,
    index: safeIndex,
    description: realm.description,
    nextName: REALM_LADDER[safeIndex + 1]?.name || null,
    readiness,
    eligible: Boolean(readiness) && Object.values(readiness).every((entry) => entry.met),
  };
}

export function refreshGrowth(player) {
  player.realm = getRealmSnapshot(player.realm.index || 0, player.progress, player.martialArts);
  for (const art of player.martialArts) {
    art.level = art.mastery >= 60 ? "대성"
      : art.mastery >= 35 ? "성취"
        : art.mastery >= 18 ? "숙련"
          : art.mastery >= 8 ? "소성"
            : "입문";
    const definition = MARTIAL_DEFINITIONS[art.id];
    art.availableBranches = art.branch || art.mastery < 8
      ? []
      : definition.branches.map(({ id, name, title, description, technique, tradeoff }) => ({
        id,
        name,
        title,
        description,
        technique,
        tradeoff,
      }));
  }
}

export function getBranchChoiceOptions(player) {
  const art = player.martialArts[0];
  if (!art || art.branch || art.mastery < 8) return [];
  const definition = MARTIAL_DEFINITIONS[art.id];
  return definition.branches.map((branch) => ({
    id: `build:${art.id}:${branch.id}`,
    label: `${branch.name}의 길을 택해 ${branch.technique.name}을 깨닫는다`,
    intent: "train",
    risk: branch.tradeoff,
    contextual: true,
  }));
}

export function selectBuildBranch(player, pathId, branchId) {
  const art = player.martialArts.find((candidate) => candidate.id === pathId);
  const branch = MARTIAL_DEFINITIONS[pathId]?.branches.find((candidate) => candidate.id === branchId);
  if (!art || !branch || art.branch || art.mastery < 8) return null;
  art.branch = {
    id: branch.id,
    name: branch.name,
    title: branch.title,
    description: branch.description,
    tradeoff: branch.tradeoff,
    bonusIntents: [...branch.bonusIntents],
    penaltyIntents: [...branch.penaltyIntents],
  };
  art.techniques.push({ ...branch.technique, unlockedAt: art.mastery });
  refreshGrowth(player);
  return branch;
}

export function realmNames() {
  return REALM_LADDER.map((realm) => realm.name);
}

