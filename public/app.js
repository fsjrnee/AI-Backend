const STORAGE_KEY = "murim-session-id";

const elements = {
  connectionStatus: document.querySelector("#connection-status"),
  startScreen: document.querySelector("#start-screen"),
  gameScreen: document.querySelector("#game-screen"),
  characterForm: document.querySelector("#character-form"),
  startButton: document.querySelector("#start-button"),
  actionForm: document.querySelector("#action-form"),
  input: document.querySelector("#action-input"),
  sendButton: document.querySelector("#send-button"),
  messages: document.querySelector("#messages"),
  choices: document.querySelector("#choices"),
  newGameButton: document.querySelector("#new-game-button"),
  toast: document.querySelector("#toast"),
};

const selectConfig = [
  ["origins", "origin-select", "origin-description"],
  ["pasts", "past-select", "past-description"],
  ["talents", "talent-select", "talent-description"],
  ["tenets", "tenet-select", "tenet-description"],
  ["bonds", "bond-select", "bond-description"],
  ["martialPaths", "martial-path-select", "martial-path-description"],
  ["goals", "long-goal-select", "long-goal-description"],
];

let sessionId = localStorage.getItem(STORAGE_KEY);
let latestChoices = [];
let busy = false;

const realmNames = ["삼류", "이류", "일류", "절정", "초절정", "화경", "현경", "생사경", "조화경"];

boot();

async function boot() {
  try {
    const [health, optionData] = await Promise.all([
      request("/api/health"),
      request("/api/game/options"),
    ]);
    elements.connectionStatus.innerHTML = '<span class="status-dot"></span>서버 연결됨';
    elements.connectionStatus.classList.remove("error");
    populateCharacterOptions(optionData.options);

    if (sessionId) {
      try {
        const restored = await request(`/api/game/state/${sessionId}`);
        showGame();
        appendMessage("기록을 다시 펼쳤습니다. 현재 상태에서 계속할 수 있습니다.", "system");
        updateGame(restored);
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
        sessionId = null;
        if (error.status !== 404) throw error;
      }
    }

    return health;
  } catch (error) {
    elements.connectionStatus.innerHTML = '<span class="status-dot"></span>서버 연결 실패';
    elements.connectionStatus.classList.add("error");
    showToast(error.message);
  }
}

elements.characterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const data = new FormData(elements.characterForm);
  const character = Object.fromEntries(data.entries());
  setBusy(true, "start");

  try {
    const result = await request("/api/game/start", {
      method: "POST",
      body: JSON.stringify({ character }),
    });
    sessionId = result.sessionId;
    localStorage.setItem(STORAGE_KEY, sessionId);
    elements.messages.replaceChildren();
    showGame();
    appendMessage(result.reply, "narrator", result.resolution);
    updateGame(result);
    elements.input.focus();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false, "start");
  }
});

elements.actionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elements.input.value.trim();
  if (!message || busy) return;
  elements.input.value = "";
  resizeInput();
  await performAction({ message });
});

elements.input.addEventListener("input", resizeInput);
elements.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.actionForm.requestSubmit();
  }
});

document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (busy || ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) return;
  const index = Number(event.key) - 1;
  if (Number.isInteger(index) && latestChoices[index]) {
    performAction({ choiceId: latestChoices[index].id, displayText: latestChoices[index].label });
  }
});

elements.newGameButton.addEventListener("click", () => {
  sessionId = null;
  latestChoices = [];
  localStorage.removeItem(STORAGE_KEY);
  elements.messages.replaceChildren();
  elements.gameScreen.hidden = true;
  elements.startScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

for (const tab of document.querySelectorAll(".state-tab")) {
  tab.addEventListener("click", () => {
    for (const candidate of document.querySelectorAll(".state-tab")) {
      candidate.classList.toggle("active", candidate === tab);
    }
    for (const panel of document.querySelectorAll(".state-panel")) {
      panel.hidden = panel.id !== tab.dataset.statePanel;
    }
  });
}

async function performAction({ message, choiceId, displayText }) {
  if (!sessionId || busy) return;
  const playerText = displayText || message;
  const playerMessage = appendMessage(playerText, "player");
  setBusy(true, "action");

  try {
    const result = await request("/api/game/action", {
      method: "POST",
      body: JSON.stringify({ sessionId, message, choiceId }),
    });

    for (const event of result.resolution?.preEvents || []) {
      appendMessage(event, "system");
    }
    updateMessageText(playerMessage, result.resolution?.actionNarration || playerText);
    appendMessage(result.reply, "narrator", result.resolution);
    if (result.warning) showToast(result.warning);
    updateGame(result);
  } catch (error) {
    appendMessage(error.message, "error");
    if (error.status === 404) {
      localStorage.removeItem(STORAGE_KEY);
      sessionId = null;
      showToast("서버가 재시작되어 새 게임이 필요합니다.");
    }
  } finally {
    setBusy(false, "action");
    elements.input.focus();
  }
}

function populateCharacterOptions(options) {
  for (const [group, selectId, descriptionId] of selectConfig) {
    const select = document.querySelector(`#${selectId}`);
    const description = document.querySelector(`#${descriptionId}`);
    const values = options[group] || [];

    select.replaceChildren(...values.map((value) => {
      const option = document.createElement("option");
      option.value = value.id;
      option.textContent = value.name;
      return option;
    }));

    const updateDescription = () => {
      const selected = values.find((value) => value.id === select.value);
      description.textContent = selected?.description || "";
    };
    select.addEventListener("change", updateDescription);
    updateDescription();
  }
}

function updateGame(result) {
  const state = result.state;
  if (!state) return;

  document.querySelector("#scene-meta").textContent =
    `제 ${state.world.day}일 · ${state.world.period} · ${state.scene.type} · 위험 ${state.scene.intensity}`;
  document.querySelector("#scene-location").textContent = state.scene.location;
  document.querySelector("#scene-objective").textContent = state.scene.objective;
  document.querySelector("#chapter-value").textContent = state.chapter;
  document.querySelector("#turn-value").textContent = state.turn;

  document.querySelector("#player-name").textContent = state.player.name;
  document.querySelector("#realm-badge").textContent = state.player.realm.name;
  updateResource("health", state.player.resources.health, state.player.resources.maxHealth);
  updateResource("qi", state.player.resources.qi, state.player.resources.maxQi);
  updateResource("balance", state.player.resources.balance, state.player.resources.maxBalance);
  renderConditions(state.player.conditions);
  renderCombat(state.combat);
  renderList("#goal-list", state.goals.active, "진행 중인 목표가 없습니다.");
  renderClues(state.clues);
  renderRelationships(state.relationships);
  renderGrowth(state.player);
  renderChoices(result.choices || []);
}

function renderChoices(choices) {
  latestChoices = choices;
  elements.choices.replaceChildren(...choices.map((choice, index) => {
    const button = document.createElement("button");
    const number = document.createElement("span");
    const label = document.createElement("span");
    const risk = document.createElement("span");

    button.type = "button";
    button.className = "choice-button";
    button.disabled = busy;
    number.className = "choice-number";
    number.textContent = index + 1;
    label.textContent = choice.label;
    risk.className = "choice-risk";
    risk.textContent = `위험: ${choice.risk}`;
    button.append(number, label, risk);
    button.addEventListener("click", () => {
      performAction({ choiceId: choice.id, displayText: choice.label });
    });
    return button;
  }));
}

function appendMessage(text, role, resolution) {
  const item = document.createElement("article");
  const label = document.createElement("div");
  const bubble = document.createElement("div");
  const labels = {
    player: "나의 행동",
    narrator: "강호의 응답",
    system: "변화",
    error: "오류",
  };

  item.className = `message ${role}`;
  label.className = "message-label";
  label.textContent = labels[role] || "기록";
  bubble.className = "bubble";
  bubble.textContent = normalizeDisplayText(text);
  item.append(label, bubble);

  if (resolution?.outcome) {
    const strip = document.createElement("div");
    strip.className = "roll-strip";
    const outcome = document.createElement("span");
    outcome.className = "outcome";
    outcome.textContent = outcomeLabel(resolution.outcome);
    strip.append(outcome);

    for (const cost of (resolution.costs || []).slice(0, 3)) {
      const tag = document.createElement("span");
      tag.textContent = cost;
      strip.append(tag);
    }
    for (const growth of (resolution.growth || []).slice(0, 2)) {
      const tag = document.createElement("span");
      tag.className = "growth-chip";
      tag.textContent = growth;
      strip.append(tag);
    }
    item.append(strip);
  }

  elements.messages.append(item);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return item;
}

function updateMessageText(item, text) {
  const bubble = item?.querySelector(".bubble");
  if (bubble) bubble.textContent = normalizeDisplayText(text);
}

function updateResource(id, value, max) {
  document.querySelector(`#${id}-value`).textContent = `${value}/${max}`;
  document.querySelector(`#${id}-bar`).style.width = `${Math.max(0, (value / max) * 100)}%`;
}

function renderConditions(conditions) {
  const container = document.querySelector("#condition-list");
  if (!conditions.length) {
    const healthy = document.createElement("span");
    healthy.className = "tag healthy";
    healthy.textContent = "이상 없음";
    container.replaceChildren(healthy);
    return;
  }
  container.replaceChildren(...conditions.map((condition) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `${condition.name} · ${condition.duration}턴`;
    return tag;
  }));
}

function renderCombat(combat) {
  const card = document.querySelector("#combat-card");
  card.hidden = !combat;
  if (!combat) return;
  document.querySelector("#enemy-name").textContent = combat.enemy.name;
  document.querySelector("#combat-objective").textContent = combat.objective;
  document.querySelector("#combat-distance").textContent = combat.distance;
  document.querySelector("#combat-terrain").textContent = combat.terrain;
  document.querySelector("#enemy-health").textContent = combat.enemy.health;
  document.querySelector("#enemy-morale").textContent = combat.enemy.morale;
}

function renderClues(clues) {
  document.querySelector("#clue-count").textContent = clues.length;
  renderList(
    "#clue-list",
    clues.map((clue) => clue.text),
    "아직 확정된 단서가 없습니다.",
  );
}

function renderRelationships(relationships) {
  const container = document.querySelector("#relationship-list");
  const entries = Object.values(relationships);
  container.replaceChildren(...entries.map((relation) => {
    const item = document.createElement("div");
    const name = document.createElement("strong");
    const state = document.createElement("span");
    item.className = "relationship";
    name.textContent = relation.name;
    state.textContent =
      `${relation.stage} · 신뢰 ${signed(relation.trust)} · 빚 ${signed(relation.debt)} · 경계 ${relation.fear}`;
    item.append(name, state);
    return item;
  }));
}

function renderGrowth(player) {
  const realm = player.realm;
  document.querySelector("#growth-realm-name").textContent = realm.name;
  document.querySelector("#growth-realm-description").textContent = realm.description;
  document.querySelector("#next-realm-badge").textContent = realm.nextName
    ? `다음 · ${realm.nextName}`
    : "무학의 완성";

  const ladder = document.querySelector("#realm-ladder");
  ladder.replaceChildren(...realmNames.map((name, index) => {
    const step = document.createElement("span");
    step.textContent = name;
    step.className = index < realm.index ? "passed" : index === realm.index ? "current" : "locked";
    return step;
  }));

  const status = document.querySelector("#breakthrough-status");
  status.textContent = realm.nextName
    ? realm.eligible ? "돌파 가능" : "준비 중"
    : "최종 경지";
  status.classList.toggle("ready", realm.eligible);
  const requirements = document.querySelector("#breakthrough-requirements");
  const requirementLabels = {
    mastery: "주력 무공 숙련",
    practice: "수련 축적",
    combatExperience: "실전 경험",
    insight: "깨달음",
    bodyCondition: "신체 준비",
  };
  requirements.replaceChildren(...Object.entries(realm.readiness || {}).map(([key, value]) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("i");
    const amount = document.createElement("strong");
    row.className = `growth-row${value.met ? " met" : ""}`;
    label.textContent = requirementLabels[key] || key;
    track.className = "growth-track";
    fill.style.width = `${Math.min(100, (value.current / value.required) * 100)}%`;
    track.append(fill);
    amount.textContent = `${value.current}/${value.required}`;
    row.append(label, track, amount);
    return row;
  }));

  const martialList = document.querySelector("#martial-art-list");
  martialList.replaceChildren(...player.martialArts.map((art) => {
    const card = document.createElement("article");
    const heading = document.createElement("div");
    const title = document.createElement("strong");
    const level = document.createElement("span");
    const principle = document.createElement("p");
    const mastery = document.createElement("div");
    const tradeoff = document.createElement("p");
    const techniques = document.createElement("ul");

    card.className = "martial-art";
    heading.className = "martial-heading";
    title.textContent = `${art.name} · ${art.category}`;
    level.textContent = `${art.level} · 숙련 ${art.mastery}`;
    heading.append(title, level);
    principle.className = "martial-principle";
    principle.textContent = art.principle;
    mastery.className = "mastery-track";
    const masteryFill = document.createElement("i");
    masteryFill.style.width = `${Math.min(100, (art.mastery / 60) * 100)}%`;
    mastery.append(masteryFill);
    tradeoff.className = "tradeoff";
    tradeoff.textContent = `교환조건 · ${art.branch?.tradeoff || art.tradeoff}`;
    techniques.className = "technique-list";
    techniques.replaceChildren(...art.techniques.map((technique) => {
      const item = document.createElement("li");
      const techniqueName = document.createElement("strong");
      const description = document.createElement("span");
      techniqueName.textContent = technique.name;
      description.textContent = technique.description;
      item.append(techniqueName, description);
      return item;
    }));
    card.append(heading, principle, mastery, tradeoff, techniques);

    if (art.availableBranches?.length) {
      const notice = document.createElement("p");
      notice.className = "branch-notice";
      notice.textContent = "새 빌드 분기가 열렸습니다. 이야기 아래의 상황별 제안에서 한 계통을 선택할 수 있습니다.";
      card.append(notice);
    } else if (art.branch) {
      const branch = document.createElement("p");
      branch.className = "branch-selected";
      branch.textContent = `선택한 계통 · ${art.branch.name} — ${art.branch.title}`;
      card.append(branch);
    }
    return card;
  }));

  renderList(
    "#growth-log",
    player.growthLog.slice(-6).reverse().map((entry) => `${entry.turn}턴 · ${entry.text}`),
    "아직 기록할 만한 성장이 없습니다.",
  );
}

function renderList(selector, values, emptyText) {
  const list = document.querySelector(selector);
  if (!values.length) {
    const empty = document.createElement("li");
    empty.className = "empty-note";
    empty.textContent = emptyText;
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...values.map((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    return item;
  }));
}

function setBusy(value, scope) {
  busy = value;
  elements.input.disabled = value;
  elements.sendButton.disabled = value;
  elements.startButton.disabled = value;
  elements.sendButton.textContent = value && scope === "action" ? "판정 중…" : "행동";
  elements.startButton.textContent = value && scope === "start"
    ? "인연을 엮는 중…"
    : "강호에 발을 들인다";
  for (const button of elements.choices.querySelectorAll("button")) {
    button.disabled = value;
  }
}

function showGame() {
  elements.startScreen.hidden = true;
  elements.gameScreen.hidden = false;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 5000);
}

function resizeInput() {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 150)}px`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function outcomeLabel(outcome) {
  return {
    introduction: "도입",
    automatic: "자동 성공",
    strong_success: "큰 성공",
    success: "성공",
    costly_success: "대가 있는 성공",
    failure: "실패",
    critical_failure: "치명적 실패",
    defeat_forward: "패배 후 전진",
    impossible: "현재 불가능",
  }[outcome] || outcome;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function normalizeDisplayText(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

