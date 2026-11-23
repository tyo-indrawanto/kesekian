/**
 * js/ui.js
 * Mengelola render antarmuka (DOM), tema, warna aksen, dan tampilan tab.
 */

class GymUI {
  constructor(state) {
    this.state = state;
    this.toastTimer = null;
    this.cacheElements();
  }

  cacheElements() {
    this.htmlEl = document.documentElement;
    this.headerDateLabel = document.getElementById("headerDateLabel");
    this.goalToggleBtn = document.getElementById("goalToggleBtn");
    this.goalBadgeText = document.getElementById("goalBadgeText");
    this.settingsGoalSelect = document.getElementById("settingsGoalSelect");

    this.accentPickerBtn = document.getElementById("accentPickerBtn");
    this.accentDrawer = document.getElementById("accentDrawer");
    this.swatches = Array.from(document.querySelectorAll(".swatch"));

    this.themeToggleBtn = document.getElementById("themeToggleBtn");
    this.iconMoon = document.getElementById("iconMoon");
    this.iconSun = document.getElementById("iconSun");

    // Tab views & bottom nav
    this.navItems = Array.from(document.querySelectorAll(".nav-item"));
    this.tabViews = Array.from(document.querySelectorAll(".tab-view"));

    // Stats strip
    this.todayTotalSets = document.getElementById("todayTotalSets");
    this.todayTotalVolume = document.getElementById("todayTotalVolume");
    this.goalFocusStatLabel = document.getElementById("goalFocusStatLabel");
    this.goalFocusStatValue = document.getElementById("goalFocusStatValue");

    // Form & Smart Prefill
    this.setInputForm = document.getElementById("setInputForm");
    this.muscleGroupSelect = document.getElementById("muscleGroupSelect");
    this.exerciseInput = document.getElementById("exerciseInput");
    this.exerciseSuggestions = document.getElementById("exerciseSuggestions");
    this.prefillBar = document.getElementById("prefillBar");
    this.prefillText = document.getElementById("prefillText");
    this.weightInput = document.getElementById("weightInput");
    this.repsInput = document.getElementById("repsInput");
    this.rirSelect = document.getElementById("rirSelect");

    // Today logs & meta
    this.sessionSetCountBadge = document.getElementById("sessionSetCountBadge");
    this.todayLogsContainer = document.getElementById("todayLogsContainer");
    this.bodyWeightInput = document.getElementById("bodyWeightInput");
    this.sessionNoteInput = document.getElementById("sessionNoteInput");

    // Progress tab
    this.weeklyMuscleVolumeContainer = document.getElementById("weeklyMuscleVolumeContainer");
    this.filterExerciseSelect = document.getElementById("filterExerciseSelect");
    this.historyLogsContainer = document.getElementById("historyLogsContainer");

    // Toast
    this.toastEl = document.getElementById("toastNotification");
  }

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.remove("hidden");

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.add("hidden");
    }, 2400);
  }

  switchTab(targetId) {
    this.tabViews.forEach((view) => {
      view.classList.toggle("active", view.id === targetId);
    });
    this.navItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === targetId);
    });

    if (targetId === "view-progress") {
      this.renderProgressTab();
    }
  }

  toggleAccentDrawer() {
    this.accentDrawer.classList.toggle("hidden");
  }

  applyTheme(theme) {
    this.htmlEl.setAttribute("data-theme", theme);
    const isLight = theme === "light";
    this.iconMoon.classList.toggle("hidden", isLight);
    this.iconSun.classList.toggle("hidden", !isLight);
  }

  applyAccent(accent) {
    this.htmlEl.setAttribute("data-accent", accent);
    this.swatches.forEach((swatch) => {
      swatch.classList.toggle("active", swatch.dataset.accent === accent);
    });
  }

  applyGoal(goal) {
    this.htmlEl.setAttribute("data-goal", goal);
    const isBulk = goal === "bulk";
    this.goalBadgeText.textContent = isBulk ? "Massa Otot" : "Diet";
    if (this.settingsGoalSelect) {
      this.settingsGoalSelect.value = goal;
    }
    this.renderStatsStrip();
  }

  renderHeaderDate() {
    if (this.headerDateLabel) {
      this.headerDateLabel.textContent = formatIndonesianDate(new Date());
    }
  }

  renderStatsStrip() {
    const summary = this.state.getTodaySummary();
    this.todayTotalSets.textContent = `${summary.totalSets}`;
    this.todayTotalVolume.textContent = `${summary.totalVolume.toLocaleString("id-ID")} kg`;
    this.goalFocusStatLabel.textContent = summary.focusLabel;
    this.goalFocusStatValue.textContent = summary.focusValue;
  }

  updateSmartPrefill(exerciseName) {
    const lastSet = this.state.getLastSetForExercise(exerciseName);
    if (!lastSet) {
      this.prefillBar.classList.add("hidden");
      return;
    }

    this.prefillBar.classList.remove("hidden");
    const rirPart = lastSet.rir !== null && lastSet.rir !== undefined ? ` • RIR ${lastSet.rir}` : "";
    this.prefillText.textContent = `Terakhir: ${lastSet.weight} kg × ${lastSet.reps} reps${rirPart}`;

    if (!this.weightInput.value) {
      this.weightInput.value = lastSet.weight;
    }
    if (!this.repsInput.value) {
      this.repsInput.value = lastSet.reps;
    }
  }

  adjustWeightInput(delta) {
    const current = parseFloat(this.weightInput.value) || 0;
    const next = Math.max(0, +(current + delta).toFixed(1));
    this.weightInput.value = next;
  }

  adjustRepsInput(delta) {
    const current = parseInt(this.repsInput.value, 10) || 0;
    const next = Math.max(1, current + delta);
    this.repsInput.value = next;
  }

  renderTodayLogs() {
    const sets = this.state.getTodaySets();
    this.sessionSetCountBadge.textContent = `${sets.length} set`;

    if (sets.length === 0) {
      this.todayLogsContainer.innerHTML = `<p class="empty-state">Belum ada set tercatat hari ini. Masukkan beban dan repetisi pertama kamu di atas.</p>`;
      return;
    }

    this.todayLogsContainer.innerHTML = sets
      .map((item, idx) => {
        const vol = getSetVolume(item);
        const isPR = this.state.isPersonalRecord(item);
        const rirBadge =
          item.rir !== null && item.rir !== undefined ? ` • RIR ${this.escapeHTML(item.rir)}` : "";

        return `
          <div class="log-item" data-id="${this.escapeHTML(item.id)}">
            <div class="log-main">
              <div class="log-title-row">
                <span class="log-exercise">#${idx + 1} ${this.escapeHTML(item.exercise)}</span>
                <span class="muscle-tag">${this.escapeHTML(item.muscleGroup)}</span>
                ${isPR ? `<span class="pr-tag">PR</span>` : ""}
              </div>
              <div class="log-metrics">
                <strong>${item.weight} kg</strong> × <strong>${item.reps} reps</strong>${rirBadge} • Vol: ${vol.toLocaleString("id-ID")} kg
              </div>
            </div>
            <button type="button" class="delete-set-btn" data-delete-id="${this.escapeHTML(item.id)}" aria-label="Hapus set" title="Hapus set">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        `;
      })
      .join("");
  }

  renderSessionMeta() {
    const meta = this.state.getTodayMeta();
    this.bodyWeightInput.value = meta.bodyWeight !== "" ? meta.bodyWeight : "";
    this.sessionNoteInput.value = meta.note || "";
  }

  renderExerciseSuggestions() {
    const defaults = [
      "Barbell Bench Press",
      "Incline Dumbbell Press",
      "Lat Pulldown",
      "Barbell Row",
      "Barbell Squat",
      "Romanian Deadlift",
      "Overhead Press",
      "Lateral Raise",
      "Bicep Curl",
      "Tricep Pushdown"
    ];
    const saved = this.state.getDistinctExercises();
    const merged = Array.from(new Set([...defaults, ...saved]));

    this.exerciseSuggestions.innerHTML = merged
      .map((name) => `<option value="${this.escapeHTML(name)}"></option>`)
      .join("");
  }

  renderProgressTab() {
    this.renderWeeklyMuscleVolume();
    this.renderExerciseFilterOptions();
    this.renderHistoryList(this.filterExerciseSelect.value || "ALL");
  }

  renderWeeklyMuscleVolume() {
    const breakdown = this.state.getWeeklyMuscleVolume();
    const maxVol = Math.max(...breakdown.map((b) => b.volume), 0);

    if (maxVol === 0) {
      this.weeklyMuscleVolumeContainer.innerHTML = `<p class="empty-state">Data volume mingguan akan muncul setelah ada set latihan tersimpan.</p>`;
      return;
    }

    this.weeklyMuscleVolumeContainer.innerHTML = breakdown
      .map((row) => {
        const pct = maxVol > 0 ? Math.round((row.volume / maxVol) * 100) : 0;
        return `
          <div class="muscle-bar-row">
            <div class="muscle-bar-header">
              <span>${this.escapeHTML(row.muscleGroup)} (${row.sets} set)</span>
              <span>${row.volume.toLocaleString("id-ID")} kg</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderExerciseFilterOptions() {
    const currentVal = this.filterExerciseSelect.value || "ALL";
    const exercises = this.state.getDistinctExercises();

    this.filterExerciseSelect.innerHTML =
      `<option value="ALL">Semua Gerakan</option>` +
      exercises
        .map(
          (ex) =>
            `<option value="${this.escapeHTML(ex)}" ${
              ex.toLowerCase() === currentVal.toLowerCase() ? "selected" : ""
            }>${this.escapeHTML(ex)}</option>`
        )
        .join("");
  }

  renderHistoryList(selectedExercise = "ALL") {
    let sets = this.state.getAllSetsSorted();
    if (selectedExercise !== "ALL") {
      sets = sets.filter(
        (item) => item.exercise.trim().toLowerCase() === selectedExercise.trim().toLowerCase()
      );
    }

    if (sets.length === 0) {
      this.historyLogsContainer.innerHTML = `<p class="empty-state">Belum ada riwayat latihan yang cocok.</p>`;
      return;
    }

    this.historyLogsContainer.innerHTML = sets
      .slice(0, 50)
      .map((item) => {
        const vol = getSetVolume(item);
        const isPR = this.state.isPersonalRecord(item);
        const meta = this.state.data.sessionMeta[item.date];
        const noteSnippet = meta && meta.note ? ` • <em>"${this.escapeHTML(meta.note)}"</em>` : "";
        const bwSnippet = meta && meta.bodyWeight ? ` • BB: ${this.escapeHTML(meta.bodyWeight)} kg` : "";

        return `
          <div class="log-item">
            <div class="log-main">
              <div class="log-title-row">
                <span class="log-exercise">${this.escapeHTML(item.exercise)}</span>
                <span class="muscle-tag">${this.escapeHTML(item.muscleGroup)}</span>
                ${isPR ? `<span class="pr-tag">PR</span>` : ""}
              </div>
              <div class="log-metrics">
                ${this.escapeHTML(item.date)} • <strong>${item.weight} kg</strong> × <strong>${item.reps} reps</strong> (Vol: ${vol.toLocaleString("id-ID")} kg)${bwSnippet}${noteSnippet}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderAll() {
    const settings = this.state.getSettings();
    this.renderHeaderDate();
    this.applyTheme(settings.theme);
    this.applyAccent(settings.accent);
    this.applyGoal(settings.goal);
    this.renderExerciseSuggestions();
    this.renderTodayLogs();
    this.renderSessionMeta();
    this.renderStatsStrip();
  }
}
