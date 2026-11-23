/**
 * js/app.js
 * Titik masuk utama aplikasi: event handling, rest timer, PWA install, & Service Worker.
 */

document.addEventListener("DOMContentLoaded", () => {
  const initialData = loadAppData();
  const state = new GymState(initialData);
  const ui = new GymUI(state);

  // Rest Timer state
  let defaultRestSeconds = Number(state.getSettings().defaultRest) || 90;
  let remainingSeconds = defaultRestSeconds;
  let timerIntervalId = null;
  let deferredInstallPrompt = null;

  const timerDisplay = document.getElementById("timerDisplay");
  const timerStartPauseBtn = document.getElementById("timerStartPauseBtn");
  const timerResetBtn = document.getElementById("timerResetBtn");
  const restChipBtns = Array.from(document.querySelectorAll(".chip-btn[data-rest]"));

  function formatTime(sec) {
    const safeSec = Math.max(0, sec);
    const mins = String(Math.floor(safeSec / 60)).padStart(2, "0");
    const secs = String(safeSec % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function syncRestChips() {
    restChipBtns.forEach((btn) => {
      const val = Number(btn.dataset.rest);
      btn.classList.toggle("active", val === defaultRestSeconds);
    });
  }

  function renderTimer() {
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(remainingSeconds);
    }
    if (timerStartPauseBtn) {
      timerStartPauseBtn.textContent = timerIntervalId ? "Jeda" : "Mulai";
    }
  }

  function playTimerAlert() {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 250);
    } catch (_) {
      // Abaikan jika browser membatasi audio tanpa interaksi langsung
    }
  }

  function stopTimer() {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    renderTimer();
  }

  function startTimer(secondsToRun) {
    stopTimer();
    remainingSeconds = typeof secondsToRun === "number" ? secondsToRun : defaultRestSeconds;
    if (remainingSeconds <= 0) remainingSeconds = defaultRestSeconds;

    timerIntervalId = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        stopTimer();
        playTimerAlert();
        ui.showToast("Waktu istirahat selesai! Siap lanjut set.");
      } else {
        renderTimer();
      }
    }, 1000);

    renderTimer();
  }

  // Render awal
  ui.renderAll();
  syncRestChips();
  renderTimer();

  // Theme & Accent Controls
  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    const nextTheme = state.toggleTheme();
    ui.applyTheme(nextTheme);
    ui.showToast(nextTheme === "dark" ? "Tema Gelap aktif" : "Tema Terang aktif");
  });

  document.getElementById("accentPickerBtn")?.addEventListener("click", () => {
    ui.toggleAccentDrawer();
  });

  document.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const accent = swatch.dataset.accent;
      if (!accent) return;
      state.setAccent(accent);
      ui.applyAccent(accent);
      ui.showToast(`Warna aksen: ${accent}`);
    });
  });

  // Goal Mode Toggle (Massa Otot / Diet)
  function handleGoalChange(nextGoal) {
    state.updateSetting("goal", nextGoal);
    ui.applyGoal(nextGoal);
    ui.showToast(
      nextGoal === "bulk"
        ? "Mode Tambah Massa Otot aktif"
        : "Mode Diet / Defisit Kalori aktif"
    );
  }

  document.getElementById("goalToggleBtn")?.addEventListener("click", () => {
    const nextGoal = state.toggleGoal();
    ui.applyGoal(nextGoal);
    ui.showToast(
      nextGoal === "bulk"
        ? "Mode Tambah Massa Otot aktif"
        : "Mode Diet / Defisit Kalori aktif"
    );
  });

  document.getElementById("settingsGoalSelect")?.addEventListener("change", (e) => {
    handleGoalChange(e.target.value);
  });

  // Bottom Tab Navigation
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      if (target) ui.switchTab(target);
    });
  });

  // Smart Prefill saat nama gerakan diubah
  const exerciseInput = document.getElementById("exerciseInput");
  exerciseInput?.addEventListener("input", (e) => {
    ui.updateSmartPrefill(e.target.value);
  });

  document.querySelectorAll("[data-adj-weight]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.adjustWeightInput(parseFloat(btn.dataset.adjWeight));
    });
  });

  document.querySelectorAll("[data-adj-reps]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.adjustRepsInput(parseInt(btn.dataset.adjReps, 10));
    });
  });

  // Simpan Set Latihan
  document.getElementById("setInputForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const muscleGroup = document.getElementById("muscleGroupSelect").value;
    const exercise = exerciseInput.value.trim();
    const weight = document.getElementById("weightInput").value;
    const reps = document.getElementById("repsInput").value;
    const rir = document.getElementById("rirSelect").value;

    if (!exercise || reps === "") {
      ui.showToast("Lengkapi nama gerakan dan repetisi.");
      return;
    }

    const { isPR } = state.addSet({
      muscleGroup,
      exercise,
      weight,
      reps,
      rir
    });

    ui.renderExerciseSuggestions();
    ui.renderTodayLogs();
    ui.renderStatsStrip();
    ui.showToast(isPR ? "Set tersimpan — Rekor Baru (PR)!" : "Set latihan tersimpan");

    // Otomatis mulai rest timer setelah menyimpan set
    startTimer(defaultRestSeconds);
  });

  // Hapus Set pada Log Hari Ini
  document.getElementById("todayLogsContainer")?.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-delete-id]");
    if (!deleteBtn) return;
    const id = deleteBtn.dataset.deleteId;
    state.deleteSet(id);
    ui.renderTodayLogs();
    ui.renderStatsStrip();
    ui.showToast("Set dihapus");
  });

  // Duplikasi Sesi Terakhir
  document.getElementById("repeatLastSessionBtn")?.addEventListener("click", () => {
    const { addedCount, sourceDate } = state.repeatLastSession();
    if (addedCount === 0) {
      ui.showToast("Belum ada sesi latihan sebelumnya untuk diduplikasi.");
      return;
    }
    ui.renderTodayLogs();
    ui.renderStatsStrip();
    ui.showToast(`${addedCount} set dari ${sourceDate} disalin ke hari ini`);
  });

  // Simpan Catatan Sesi & Berat Badan
  document.getElementById("saveSessionMetaBtn")?.addEventListener("click", () => {
    const bodyWeight = document.getElementById("bodyWeightInput").value;
    const note = document.getElementById("sessionNoteInput").value;
    state.saveTodayMeta({ bodyWeight, note });
    ui.showToast("Catatan sesi & berat badan tersimpan");
  });

  // Rest Timer Controls
  restChipBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sec = Number(btn.dataset.rest);
      defaultRestSeconds = sec;
      state.updateSetting("defaultRest", sec);
      remainingSeconds = sec;
      stopTimer();
      syncRestChips();
      ui.showToast(`Durasi rest timer diatur ke ${sec} detik`);
    });
  });

  timerStartPauseBtn?.addEventListener("click", () => {
    if (timerIntervalId) {
      stopTimer();
    } else {
      startTimer(remainingSeconds > 0 ? remainingSeconds : defaultRestSeconds);
    }
  });

  timerResetBtn?.addEventListener("click", () => {
    stopTimer();
    remainingSeconds = defaultRestSeconds;
    renderTimer();
  });

  // Filter Riwayat Gerakan
  document.getElementById("filterExerciseSelect")?.addEventListener("change", (e) => {
    ui.renderHistoryList(e.target.value);
  });

  // Export & Import JSON + Reset Data
  document.getElementById("exportDataBtn")?.addEventListener("click", () => {
    exportAppDataJSON(state.data);
    ui.showToast("File cadangan JSON berhasil diunduh");
  });

  document.getElementById("importFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedData = parseImportedJSON(String(reader.result || ""));
        state.replaceAllData(importedData);
        defaultRestSeconds = Number(state.getSettings().defaultRest) || 90;
        remainingSeconds = defaultRestSeconds;
        stopTimer();
        syncRestChips();
        renderTimer();
        ui.renderAll();
        ui.renderProgressTab();
        ui.showToast("Data lokal berhasil dipulihkan dari JSON");
      } catch (err) {
        ui.showToast(err.message || "Gagal mengimpor file JSON");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("clearAllDataBtn")?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Yakin ingin menghapus seluruh riwayat latihan dan pengaturan di memori lokal?"
    );
    if (!confirmed) return;
    state.resetAllData();
    defaultRestSeconds = 90;
    remainingSeconds = 90;
    stopTimer();
    syncRestChips();
    renderTimer();
    ui.renderAll();
    ui.renderProgressTab();
    ui.showToast("Semua data lokal telah dibersihkan");
  });

  // PWA Install Prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  document.getElementById("installPwaBtn")?.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === "accepted") {
        ui.showToast("Aplikasi sedang diinstal ke layar utama");
      }
    } else {
      ui.showToast("Buka menu browser (⋮ / Share) lalu pilih 'Add to Home screen'");
    }
  });

  // Register Service Worker untuk mode offline di GitHub Pages
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch((err) => console.warn("Registrasi Service Worker gagal:", err));
    });
  }
});
