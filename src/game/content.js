export const CHARACTER_OPTIONS = {
  origins: [
    {
      id: "border_refugee",
      name: "변경 난민",
      description: "전란을 피해 떠돌았다. 민초와 야외 생존에 익숙하다.",
      effects: { body: 1, survival: 1, coins: -4 },
    },
    {
      id: "merchant_apprentice",
      name: "상단 견습",
      description: "장부와 흥정을 배웠다. 돈과 물자의 흐름을 읽는다.",
      effects: { wits: 1, presence: 1, coins: 8 },
    },
    {
      id: "fallen_house",
      name: "몰락 세가의 후예",
      description: "예법과 검리를 알지만 오래된 빚과 시선이 따라붙는다.",
      effects: { martial: 1, presence: 1, coins: -2 },
    },
    {
      id: "temple_orphan",
      name: "산사에서 자란 고아",
      description: "호흡과 절제를 배웠다. 세속 인맥은 약하지만 마음이 단단하다.",
      effects: { spirit: 2, coins: -6 },
    },
  ],
  pasts: [
    {
      id: "failed_rescue",
      name: "구하지 못한 사람",
      description: "망설임 때문에 한 사람을 잃었다. 구조와 희생 앞에서 흔들린다.",
    },
    {
      id: "false_accusation",
      name: "누명을 쓰고 떠남",
      description: "증거 없는 비난을 겪었다. 소문보다 사실을 중시한다.",
    },
    {
      id: "stolen_manual",
      name: "사라진 유품",
      description: "가문의 낡은 비급 조각을 도둑맞았다. 장기 비밀과 연결된다.",
    },
  ],
  talents: [
    { id: "keen_eye", name: "예리한 눈", description: "숨은 단서와 자세의 틈을 빨리 찾는다.", effects: { wits: 1 } },
    { id: "iron_bones", name: "강골", description: "부상 충격과 외공 수련을 잘 견딘다.", effects: { body: 1 } },
    { id: "quick_step", name: "가벼운 발", description: "이동, 추격, 거리 조절에 강하다.", effects: { agility: 1 } },
    { id: "calm_breath", name: "고른 호흡", description: "내력 운용과 공포 저항에 강하다.", effects: { spirit: 1 } },
  ],
  tenets: [
    { id: "keep_promise", name: "한번 한 약속은 지킨다", description: "약속 이행 시 신뢰가 크게 오르지만 파기 비용도 크다." },
    { id: "no_kill", name: "가능하면 목숨을 빼앗지 않는다", description: "비살상 해결이 강점이 되지만 흉적과의 싸움은 어려워진다." },
    { id: "repay_debt", name: "은혜와 원한은 반드시 갚는다", description: "빚과 은원이 강력한 동기가 되며 세력 갈등에 휘말리기 쉽다." },
    { id: "expose_truth", name: "불편해도 진실을 드러낸다", description: "단서와 폭로에 강하지만 체면을 중시하는 인물을 자극한다." },
  ],
  bonds: [
    { id: "missing_sibling", name: "행방불명된 의형제", description: "마지막 소식은 청류현의 검은 소금 표식이다." },
    { id: "herbalist_debt", name: "약초꾼에게 진 목숨빚", description: "약왕곡 계열 인물과 연결되지만 갚아야 할 부탁이 있다." },
    { id: "retired_guard", name: "은퇴한 표사 스승", description: "기초를 가르쳐 준 스승이 과거 사건을 숨기고 있다." },
  ],
  martialPaths: [
    {
      id: "flowing_sword",
      name: "유수검 초식",
      description: "빠른 연계와 반격. 좁은 곳과 중갑 상대에게 불리하다.",
      effects: { agility: 1, martial: 1 },
    },
    {
      id: "stone_fist",
      name: "반석권 기초",
      description: "균형과 제압에 강하다. 사거리가 짧고 회피에 내력을 많이 쓴다.",
      effects: { body: 1, martial: 1 },
    },
    {
      id: "swallow_step",
      name: "비연보 입문",
      description: "거리와 지형을 장악한다. 직접 화력은 낮고 발목 부상에 취약하다.",
      effects: { agility: 2 },
    },
    {
      id: "healing_needles",
      name: "청맥침법",
      description: "치료와 비살상 제압에 유용하다. 준비와 정확한 관찰이 필요하다.",
      effects: { wits: 1, spirit: 1 },
    },
  ],
  goals: [
    { id: "restore_name", name: "잃어버린 이름과 명예를 되찾는다" },
    { id: "find_family", name: "사라진 가족 또는 인연을 찾는다" },
    { id: "create_art", name: "누구의 모방도 아닌 무공을 완성한다" },
    { id: "protect_route", name: "민초가 안전하게 다니는 길을 만든다" },
  ],
};

export const FACTIONS = [
  { id: "white_crane", name: "백학문", type: "정파", agenda: "흩어진 강호의 규율 회복", risk: "체면을 위해 내부 부패를 덮는다" },
  { id: "iron_blood", name: "철혈방", type: "사파", agenda: "하층 무인에게 일자리와 보호 제공", risk: "보호비와 폭력으로 질서를 독점한다" },
  { id: "black_lotus", name: "흑련교", type: "마도", agenda: "관부와 문벌의 독점을 파괴", risk: "목적을 위해 금단 무공과 희생을 허용한다" },
  { id: "namgung", name: "남궁세가", type: "세가", agenda: "검법과 혈통의 권위 유지", risk: "혼인과 채무로 사람을 자산처럼 다룬다" },
  { id: "ten_thousand_li", name: "만리상단", type: "상단", agenda: "전란 속 교역로 유지", risk: "안정을 위해 어느 세력과도 거래한다" },
  { id: "pacification_office", name: "순무영", type: "관부", agenda: "사병과 무림 분쟁 억제", risk: "무공 등록제와 연좌제를 확대한다" },
  { id: "blue_gate", name: "청문각", type: "정보 조직", agenda: "정보의 독점을 막는다는 명분", risk: "진실과 거짓을 함께 팔아 균형을 조작한다" },
  { id: "medicine_valley", name: "약왕곡", type: "의술 문파", agenda: "의술과 약재 보호", risk: "치료를 대가로 위험한 임상 기록을 축적한다" },
  { id: "river_alliance", name: "수로맹", type: "수운 연합", agenda: "강과 운하의 자치", risk: "밀수와 통행세를 묵인한다" },
  { id: "white_night", name: "백야회", type: "지하 결사", agenda: "전쟁 고아와 탈주민의 생존", risk: "납치와 위조 신분을 사업화한다" },
];

export const REGIONS = [
  { id: "baekro_dock", name: "백로진", tier: 1, hook: "운하, 약재 창고, 사라지는 뱃사공", play: "조사와 관계" },
  { id: "cheongryu", name: "청류현", tier: 1, hook: "관문 도시의 무공 등록제", play: "사회 잠입과 선택" },
  { id: "white_crane_mountain", name: "백학산", tier: 2, hook: "정파의 시험과 봉인된 옛 길", play: "수련과 탐험" },
  { id: "falling_star", name: "낙성부", tier: 2, hook: "세가와 상단의 혼인 동맹", play: "정치와 결투" },
  { id: "red_gorge", name: "적하협", tier: 2, hook: "표행을 노리는 협곡 세력", play: "호위와 지형 전투" },
  { id: "cloud_dream_marsh", name: "운몽택", tier: 3, hook: "독무와 가라앉은 사당", play: "생존과 비밀" },
  { id: "iron_ridge", name: "철령광산", tier: 3, hook: "무기 생산과 광부 반란", play: "자원과 세력전" },
  { id: "jade_capital", name: "옥경", tier: 3, hook: "황도 아래 얽힌 관부와 문벌", play: "첩보와 명성" },
  { id: "north_pass", name: "북풍관", tier: 4, hook: "국경 분쟁과 난민 행렬", play: "전쟁 선택" },
  { id: "heaven_lake", name: "천호도", tier: 4, hook: "강호 수맥의 비밀 중심", play: "최종 탐험과 결말" },
];

export const NPCS = [
  { id: "seo_yeonhwa", name: "서연화", age: "20대", faction: "medicine_valley", role: "약재 운반인", voice: "짧고 정확하게 말하며 맥박을 세듯 손가락을 두드린다", desire: "도난당한 역병 약재 회수", fear: "치료 명분으로 사람을 실험하는 것", line: "환자를 버리지 않는다" },
  { id: "gang_mujin", name: "강무진", age: "60대", faction: "river_alliance", role: "늙은 뱃사공", voice: "강물과 날씨에 빗대어 에둘러 말한다", desire: "수로맹의 내전을 막기", fear: "죽은 아들의 밀수 기록 공개", line: "승객의 신분을 팔지 않는다" },
  { id: "jin_baegun", name: "진백운", age: "30대", faction: "white_crane", role: "파견 검객", voice: "예의를 지키되 질문을 두 번 반복하지 않는다", desire: "문파의 누명을 벗기기", fear: "스승의 부패가 사실일 가능성", line: "무고한 이를 희생시키지 않는다" },
  { id: "dang_soso", name: "당소소", age: "20대", faction: "blue_gate", role: "독과 소문의 중개인", voice: "농담 뒤에 가격을 붙인다", desire: "자신의 해독법을 완성", fear: "어느 조직에도 소유되는 것", line: "아이에게 독을 쓰지 않는다" },
  { id: "namgung_rin", name: "남궁린", age: "20대", faction: "namgung", role: "세가 후계 후보", voice: "상대의 문장을 고쳐 말한다", desire: "혈통이 아닌 실력으로 인정", fear: "가문의 도구가 되는 것", line: "공개 결투의 약속을 어기지 않는다" },
  { id: "mak_daeryong", name: "막대룡", age: "40대", faction: "iron_blood", role: "부두 책임자", voice: "웃으며 위협하고 액수를 명확히 말한다", desire: "부두 노동자의 생존권 확보", fear: "조직이 마도에 흡수되는 것", line: "자기 사람의 임금을 떼먹지 않는다" },
  { id: "jo_munhae", name: "조문해", age: "50대", faction: "pacification_office", role: "순무영 첨사", voice: "모든 말을 기록 문구처럼 말한다", desire: "무림 사병 해체", fear: "질서 붕괴", line: "공식 명령 없는 처형은 거부한다" },
  { id: "yeonbi", name: "연비", age: "10대 후반", faction: "white_night", role: "길잡이와 소매치기", voice: "별명을 붙이고 대답 대신 질문한다", desire: "동생들의 안전한 신분", fear: "버려지는 것", line: "피난처 위치를 팔지 않는다" },
  { id: "heo_dogwan", name: "허도관", age: "50대", faction: "black_lotus", role: "떠돌이 의원", voice: "진단하듯 냉정한 반문을 한다", desire: "금단 심법의 부작용 증명", fear: "자신이 틀렸음을 인정하는 것", line: "자료가 될 환자는 살려 둔다" },
  { id: "gwak_seol", name: "곽설", age: "30대", faction: "ten_thousand_li", role: "표국주", voice: "시간과 거리를 숫자로 센다", desire: "전란 중 교역로 유지", fear: "호위대가 민병대로 변질", line: "계약한 화물과 사람을 끝까지 지킨다" },
  { id: "mukhyeon", name: "묵현", age: "불명", faction: "blue_gate", role: "복면 정보상", voice: "사실·주장·추측을 구분해서 말한다", desire: "천기맥도의 완전한 복원", fear: "정보가 한 권력에 독점되는 것", line: "확정된 사실을 거짓으로 팔지 않는다" },
  { id: "yu_cheonga", name: "유청아", age: "20대", faction: "none", role: "유랑 악사", voice: "노랫말과 속담을 인용한다", desire: "사라진 마을의 진상 발견", fear: "기억이 조작되었다는 의심", line: "아이들의 이름을 잊지 않는다" },
];

export const ENEMIES = {
  dock_enforcer: {
    id: "dock_enforcer",
    name: "갈고리패 징수꾼",
    realm: "삼류 상단",
    health: 10,
    morale: 6,
    strength: "갈고리로 무기와 소매를 걸어 거리를 무너뜨린다",
    weakness: "왼발을 끌며 방향 전환이 느리다",
    tactic: "난간 쪽으로 몰아 협공한다",
    fear: "물에 빠져 갑옷이 무거워지는 것",
    retreat: "우두머리가 쓰러지거나 증거가 관군에게 넘어감",
    clue: "허리춤에 정식 수로맹 표식이 아닌 뒤집힌 매듭이 있다",
  },
  warehouse_guard: {
    id: "warehouse_guard",
    name: "검은 소금 창고지기",
    realm: "이류",
    health: 14,
    morale: 8,
    strength: "두꺼운 장봉으로 문과 통로를 봉쇄한다",
    weakness: "약재 연기를 두려워해 불씨에서 시선을 떼지 못한다",
    tactic: "시간을 끌어 지원을 부른다",
    fear: "창고 장부가 공개되는 것",
    retreat: "도주로가 확보되거나 고용주의 배신 증거를 봄",
    clue: "공격보다 장부 상자를 지키는 데 집착한다",
  },
};

export const SCENES = {
  baekro_dock: {
    id: "baekro_dock",
    location: "백로진 동쪽 나루",
    type: "조사",
    intensity: "중간",
    objective: "사라진 약재 수레와 부상당한 운반인의 진상을 파악한다",
    sensory: "비에 젖은 삼베 냄새, 운하의 쇠비린 물결, 뒤집힌 수레바퀴가 삐걱인다.",
    stakes: "해 지기 전 약재를 찾지 못하면 서쪽 빈민가의 열병 환자들이 밤을 넘기기 어렵다.",
    choices: [
      { id: "treat_courier", label: "서연화의 상처를 살피며 사건을 듣는다", intent: "talk", risk: "시간" },
      { id: "inspect_tracks", label: "수레와 진흙 자국을 조사한다", intent: "investigate", risk: "매복" },
      { id: "question_boatman", label: "뱃사공 강무진에게 물길을 묻는다", intent: "talk", risk: "관계" },
      { id: "chase_shadow", label: "지붕 위의 검은 그림자를 즉시 추격한다", intent: "move", risk: "부상" },
    ],
  },
  reed_warehouse: {
    id: "reed_warehouse",
    location: "갈대밭 폐창고",
    type: "침투",
    intensity: "높음",
    objective: "약재와 장부 중 무엇을 먼저 확보할지 결정한다",
    sensory: "썩은 갈대 사이로 약재의 쓴 향과 등잔 기름 냄새가 겹친다.",
    stakes: "창고지기는 지원을 부르고 있으며, 묶인 인부와 장부는 서로 다른 방에 있다.",
    choices: [
      { id: "rescue_workers", label: "갇힌 인부들을 먼저 구출한다", intent: "investigate", risk: "증거 소실" },
      { id: "steal_ledger", label: "경비를 피해 장부를 훔친다", intent: "move", risk: "인질" },
      { id: "challenge_guard", label: "경비를 끌어내 정면으로 상대한다", intent: "combat", risk: "부상" },
      { id: "offer_deal", label: "고용주가 버릴 것이라 설득해 거래한다", intent: "talk", risk: "배신" },
    ],
  },
  cheongryu_gate: {
    id: "cheongryu_gate",
    location: "청류현 남문",
    type: "선택",
    intensity: "낮음",
    objective: "얻은 증거와 인연을 바탕으로 다음 길을 정한다",
    sensory: "성문 위 등록패가 바람에 부딪히고, 시장의 종소리가 먼 산의 운무로 번진다.",
    stakes: "어느 세력에 정보를 건네느냐에 따라 도움과 적이 함께 생긴다.",
    choices: [
      { id: "report_office", label: "순무영에 장부를 넘기고 공식 수사를 요구한다", intent: "talk", risk: "무림의 불신" },
      { id: "contact_crane", label: "백학문 진백운에게 비밀리에 연락한다", intent: "talk", risk: "문파 갈등" },
      { id: "sell_information", label: "청문각과 거래해 더 큰 배후를 찾는다", intent: "talk", risk: "정보 확산" },
      { id: "leave_city", label: "누구에게도 주지 않고 다른 지역으로 떠난다", intent: "move", risk: "추적" },
    ],
  },
};

export function findOption(group, id) {
  return CHARACTER_OPTIONS[group]?.find((option) => option.id === id);
}

export function getPublicCharacterOptions() {
  return Object.fromEntries(
    Object.entries(CHARACTER_OPTIONS).map(([key, values]) => [
      key,
      values.map(({ effects, ...option }) => option),
    ]),
  );
}

