const STORAGE_KEY = "aquabloom-state-v1";

const defaultState = {
  dailyGoalMl: 2000,
  consumedMl: 0,
  glassSizeMl: 250,
  bottleSizeMl: 500,
  soundEnabled: false,
  darkMode: false,
  lastUpdatedDate: getTodayKey(),
  history: {}
};

const elements = {
  consumedMl: document.getElementById("consumedMl"),
  remainingMl: document.getElementById("remainingMl"),
  goalDisplay: document.getElementById("goalDisplay"),
  conversionText: document.getElementById("conversionText"),
  progressPercent: document.getElementById("progressPercent"),
  progressCaption: document.getElementById("progressCaption"),
  progressRing: document.getElementById("progressRing"),
  motivationMessage: document.getElementById("motivationMessage"),
  historyChart: document.getElementById("historyChart"),
  toast: document.getElementById("toast"),
  dropletStage: document.getElementById("dropletStage"),
  confettiLayer: document.getElementById("confettiLayer"),
  themeToggle: document.getElementById("themeToggle"),
  soundToggle: document.getElementById("soundToggle"),
  fabAdd: document.getElementById("fabAdd"),
  glassQuickAddLabel: document.getElementById("glassQuickAddLabel"),
  glassQuickAddAmount: document.getElementById("glassQuickAddAmount"),
  bottleQuickAddLabel: document.getElementById("bottleQuickAddLabel"),
  bottleQuickAddAmount: document.getElementById("bottleQuickAddAmount"),
  boostQuickAddLabel: document.getElementById("boostQuickAddLabel"),
  boostQuickAddAmount: document.getElementById("boostQuickAddAmount"),
  customIntakeForm: document.getElementById("customIntakeForm"),
  customIntake: document.getElementById("customIntake"),
  settingsForm: document.getElementById("settingsForm"),
  goalAmount: document.getElementById("goalAmount"),
  goalUnit: document.getElementById("goalUnit"),
  goalHint: document.getElementById("goalHint"),
  goalPreviewValue: document.getElementById("goalPreviewValue"),
  glassSize: document.getElementById("glassSize"),
  bottleSize: document.getElementById("bottleSize")
};

let state = loadState();
let toastTimer = null;
let goalCelebratedToday = false;

syncResetIfNeeded();
hydrateControls();
applyTheme();
bindEvents();
render();

function bindEvents() {
  document.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.kind;
      if (kind === "glass") {
        addWater(state.glassSizeMl);
        return;
      }
      if (kind === "bottle") {
        addWater(state.bottleSizeMl);
        return;
      }
      addWater(state.bottleSizeMl * 2);
    });
  });

  elements.goalUnit.addEventListener("change", () => {
    syncGoalInputMode();
    renderGoalPreview();
  });

  elements.goalAmount.addEventListener("input", () => {
    renderGoalPreview();
  });

  elements.customIntakeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(elements.customIntake.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount in ml.");
      return;
    }

    addWater(amount);
    elements.customIntakeForm.reset();
  });

  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const goalInput = Number(elements.goalAmount.value);
    const unit = elements.goalUnit.value;
    const glassSize = Number(elements.glassSize.value);
    const bottleSize = Number(elements.bottleSize.value);

    if (!Number.isFinite(goalInput) || goalInput <= 0) {
      showToast("Set a valid daily goal.");
      return;
    }

    state.dailyGoalMl = unit === "l" ? Math.round(goalInput * 1000) : Math.round(goalInput);
    state.glassSizeMl = glassSize;
    state.bottleSizeMl = bottleSize;
    persistState();
    render();
    showToast("Preferences saved.");
  });

  elements.themeToggle.addEventListener("click", () => {
    state.darkMode = !state.darkMode;
    persistState();
    applyTheme();
  });

  elements.soundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    persistState();
    showToast(state.soundEnabled ? "Sound feedback on." : "Sound feedback off.");
    playFeedback();
  });

  elements.fabAdd.addEventListener("click", () => addWater(state.glassSizeMl));
}

function addWater(amount) {
  syncResetIfNeeded();

  state.consumedMl += amount;
  const today = getTodayKey();
  state.history[today] = state.consumedMl;
  persistState();

  spawnDroplets();
  playFeedback();
  render();
  showToast(`Logged ${formatMl(amount)} of water.`);

  if (state.consumedMl >= state.dailyGoalMl && !goalCelebratedToday) {
    goalCelebratedToday = true;
    launchConfetti();
    showToast("Goal reached. Beautiful work.");
  }
}

function render() {
  const remaining = Math.max(state.dailyGoalMl - state.consumedMl, 0);
  const progress = Math.min(Math.round((state.consumedMl / state.dailyGoalMl) * 100), 100);
  const bottleCount = state.consumedMl / state.bottleSizeMl;
  const glassCount = state.consumedMl / state.glassSizeMl;

  elements.consumedMl.textContent = formatMl(state.consumedMl);
  elements.remainingMl.textContent = formatMl(remaining);
  elements.goalDisplay.textContent = formatMl(state.dailyGoalMl);
  elements.progressPercent.textContent = `${progress}%`;
  elements.progressCaption.textContent = `${formatNumber(state.consumedMl)} / ${formatNumber(state.dailyGoalMl)} ml`;
  elements.progressRing.style.setProperty("--progress", progress);
  elements.conversionText.textContent = `You've drunk ${formatDecimal(bottleCount)} bottles = ${formatDecimal(glassCount)} glasses = ${formatNumber(state.consumedMl)} ml`;
  elements.motivationMessage.textContent = getMotivation(progress, remaining);
  elements.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
  elements.glassQuickAddLabel.textContent = "+1 Glass";
  elements.glassQuickAddAmount.textContent = formatMl(state.glassSizeMl);
  elements.bottleQuickAddLabel.textContent = "+1 Bottle";
  elements.bottleQuickAddAmount.textContent = formatMl(state.bottleSizeMl);
  elements.boostQuickAddLabel.textContent = "+Hydration Boost";
  elements.boostQuickAddAmount.textContent = formatMl(state.bottleSizeMl * 2);
  syncGoalInputMode();
  renderGoalPreview();

  renderHistory();
}

function renderHistory() {
  const days = getLastSevenDays();
  const max = Math.max(...days.map((day) => state.history[day] || 0), state.dailyGoalMl, 1);

  elements.historyChart.innerHTML = days.map((day) => {
    const value = state.history[day] || 0;
    const height = Math.max((value / max) * 100, value > 0 ? 10 : 4);
    const label = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
    return `
      <div class="history-bar">
        <div class="history-fill-wrap">
          <div class="history-fill" style="height: ${height}%"></div>
        </div>
        <strong class="history-value">${Math.round(value)}ml</strong>
        <span class="history-day">${label}</span>
      </div>
    `;
  }).join("");
}

function hydrateControls() {
  if (state.dailyGoalMl >= 1000 && state.dailyGoalMl % 1000 === 0) {
    elements.goalAmount.value = String(state.dailyGoalMl / 1000);
    elements.goalUnit.value = "l";
  } else {
    elements.goalAmount.value = String(state.dailyGoalMl);
    elements.goalUnit.value = "ml";
  }

  elements.glassSize.value = String(state.glassSizeMl);
  elements.bottleSize.value = String(state.bottleSizeMl);
  syncGoalInputMode();
  renderGoalPreview();
}

function applyTheme() {
  document.body.classList.toggle("dark", state.darkMode);
}

function syncGoalInputMode() {
  const isLiters = elements.goalUnit.value === "l";
  if (isLiters) {
    elements.goalAmount.min = "0.25";
    elements.goalAmount.step = "0.1";
    elements.goalAmount.placeholder = "2.0";
    elements.goalHint.textContent = "Using liters. Example: 2.5 liters.";
    return;
  }

  elements.goalAmount.min = "250";
  elements.goalAmount.step = "50";
  elements.goalAmount.placeholder = "2000";
  elements.goalHint.textContent = "Using milliliters. Example: 2000 ml.";
}

function renderGoalPreview() {
  const rawValue = Number(elements.goalAmount.value);
  const unit = elements.goalUnit.value;

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    elements.goalPreviewValue.textContent = "Enter your goal to see the target.";
    return;
  }

  const goalMl = unit === "l" ? rawValue * 1000 : rawValue;
  const litersText = `${stripTrailingZeroes((goalMl / 1000).toFixed(2))} L`;
  const mlText = `${formatNumber(goalMl)} ml`;
  elements.goalPreviewValue.textContent = `${litersText} / ${mlText}`;
}

function syncResetIfNeeded() {
  const today = getTodayKey();
  if (state.lastUpdatedDate === today) {
    state.history[today] = state.consumedMl;
    return;
  }

  if (state.lastUpdatedDate) {
    state.history[state.lastUpdatedDate] = state.consumedMl;
  }

  state.consumedMl = 0;
  state.lastUpdatedDate = today;
  state.history[today] = 0;
  goalCelebratedToday = false;
  pruneHistory();
  persistState();
}

function pruneHistory() {
  const allowed = new Set(getLastSevenDays());
  Object.keys(state.history).forEach((day) => {
    if (!allowed.has(day)) {
      delete state.history[day];
    }
  });
}

function spawnDroplets() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 8; i += 1) {
    const droplet = document.createElement("span");
    droplet.className = "droplet";
    droplet.style.left = `${42 + Math.random() * 16}%`;
    droplet.style.top = `${45 + Math.random() * 10}%`;
    droplet.style.setProperty("--x", `${(Math.random() - 0.5) * 150}px`);
    droplet.style.setProperty("--y", `${-60 - Math.random() * 90}px`);
    fragment.appendChild(droplet);

    setTimeout(() => {
      droplet.remove();
    }, 1200);
  }
  elements.dropletStage.appendChild(fragment);
}

function launchConfetti() {
  const colors = ["#5ad0ff", "#71e2bc", "#ab9bff", "#ffffff", "#ff9dc0"];
  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${-10 - Math.random() * 20}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.18}s`;
    elements.confettiLayer.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 2000);
  }
}

function playFeedback() {
  if (!state.soundEnabled) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(310, audioContext.currentTime + 0.18);
  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.22);
  oscillator.onended = () => audioContext.close();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function getMotivation(progress, remaining) {
  if (progress >= 100) {
    return "Hydration level: Strong. Goal complete and glowing.";
  }
  if (progress >= 80) {
    return `You're almost there. Just ${formatMl(remaining)} to go.`;
  }
  if (progress >= 50) {
    return "Hydration level: Flowing nicely. Keep that momentum going.";
  }
  if (progress >= 25) {
    return "A great start. Another bubble or two will keep you on pace.";
  }
  return "Hydration level: Calm and steady. Start with one refreshing glass.";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState };
    }

    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      history: parsed.history || {}
    };
  } catch (error) {
    return { ...defaultState };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return toDayKey(date);
  });
}

function getTodayKey() {
  return toDayKey(new Date());
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMl(value) {
  return `${formatNumber(value)} ml`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Math.round(value));
}

function formatDecimal(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function stripTrailingZeroes(value) {
  return value.replace(/\.?0+$/, "");
}
