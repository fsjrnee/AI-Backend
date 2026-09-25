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

async function performAction({ message, choiceId, displayText }) {
  if (!sessionId || busy) return;
  const playerText = displayText || message;
  appendMessage(playerText, "player");
  setBusy(true, "action");

  try {
    const result = await request("/api/game/action", {
      method: "POST",
      body: JSON.stringify({ sessionId, message, choiceId }),
    });

    for (const event of result.resolution?.preEvents || []) {
      appendMessage(event, "system");
    }
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
  document.querySelector("#realm-badge").textContent =
    `${state.player.realm.name} ${state.player.realm.stage}단`;
  updateResource("health", state.player.resources.health, state.player.resources.maxHealth);
  updateResource("qi", state.player.resources.qi, state.player.resources.maxQi);
  updateResource("balance", state.player.resources.balance, state.player.resources.maxBalance);
  renderConditions(state.player.conditions);
  renderCombat(state.combat);
  renderList("#goal-list", state.goals.active, "진행 중인 목표가 없습니다.");
  renderClues(state.clues);
  renderRelationships(state.relationships);
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
  bubble.textContent = text;
  item.append(label, bubble);

  if (resolution?.roll || resolution?.outcome) {
    const strip = document.createElement("div");
    strip.className = "roll-strip";
    const outcome = document.createElement("span");
    outcome.className = "outcome";
    outcome.textContent = outcomeLabel(resolution.outcome);
    strip.append(outcome);

    if (resolution.roll) {
      const roll = document.createElement("span");
      roll.textContent =
        `${resolution.roll.die} ${signed(resolution.roll.modifier)} = ${resolution.roll.total} / 난이도 ${resolution.roll.dc}`;
      strip.append(roll);
    }
    for (const cost of (resolution.costs || []).slice(0, 3)) {
      const tag = document.createElement("span");
      tag.textContent = cost;
      strip.append(tag);
    }
    item.append(strip);
  }

  elements.messages.append(item);
  elements.messages.scrollTop = elements.messages.scrollHeight;
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

