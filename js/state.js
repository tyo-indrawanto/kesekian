/**
 * js/state.js
 * Logika state aplikasi, perhitungan volume beban, PR, smart prefill, dan sesi latihan.
 */

const MUSCLE_GROUPS = ["Dada", "Punggung", "Kaki", "Bahu", "Lengan", "Inti"];

function getTodayDateKey(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIndonesianDate(dateObj = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(dateObj);
}

function getSetVolume(setItem) {
  const w = Number(setItem.weight) || 0;
  const r = Number(setItem.reps) || 0;
  return w * r;
}

class GymState {
  constructor(initialData) {
    this.data = initialData;
    this.todayKey = getTodayDateKey();
  }

  getSettings() {
    return this.data.settings;
  }

  updateSetting(key, value) {
    this.data.settings[key] = value;
    saveAppData(this.data);
  }

  toggleTheme() {
    const next = this.data.settings.theme === "dark" ? "light" : "dark";
    this.updateSetting("theme", next);
    return next;
  }

  toggleGoal() {
    const next = this.data.settings.goal === "bulk" ? "cut" : "bulk";
    this.updateSetting("goal", next);
    return next;
  }

  setAccent(accent) {
    this.updateSetting("accent", accent);
  }

  getTodaySets() {
    return this.data.sets
      .filter((item) => item.date === this.todayKey)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getAllSetsSorted() {
    return [...this.data.sets].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Menghitung skor performa set untuk mendeteksi Personal Record (PR)
   * Menggunakan rumus estimasi 1RM Epley: weight * (1 + reps / 30)
   */
  getEstimated1RM(weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  isPersonalRecord(candidateSet) {
    const candidate1RM = this.getEstimated1RM(candidateSet.weight, candidateSet.reps);
    if (candidate1RM <= 0) return false;

    const normalizedName = candidateSet.exercise.trim().toLowerCase();
    const previousSameExercise = this.data.sets.filter(
      (item) =>
        item.id !== candidateSet.id &&
        item.exercise.trim().toLowerCase() === normalizedName &&
        item.timestamp <= candidateSet.timestamp
    );

    if (previousSameExercise.length === 0) return true;

    const maxPrev1RM = Math.max(
      ...previousSameExercise.map((item) => this.getEstimated1RM(item.weight, item.reps))
    );

    return candidate1RM > maxPrev1RM;
  }

  addSet({ muscleGroup, exercise, weight, reps, rir }) {
    const cleanExercise = exercise.trim();
    const numWeight = Math.max(0, Number(weight) || 0);
    const numReps = Math.max(1, parseInt(reps, 10) || 1);

    const newSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: this.todayKey,
      timestamp: Date.now(),
      muscleGroup,
      exercise: cleanExercise,
      weight: numWeight,
      reps: numReps,
      rir: rir === "" || rir === undefined ? null : Number(rir)
    };

    const isPR = this.isPersonalRecord(newSet);
    this.data.sets.push(newSet);
    saveAppData(this.data);

    return { set: newSet, isPR };
  }

  deleteSet(setId) {
    this.data.sets = this.data.sets.filter((item) => item.id !== setId);
    saveAppData(this.data);
  }

  getLastSetForExercise(exerciseName) {
    const target = exerciseName.trim().toLowerCase();
    if (!target) return null;

    const matches = this.data.sets
      .filter((item) => item.exercise.trim().toLowerCase() === target)
      .sort((a, b) => b.timestamp - a.timestamp);

    return matches[0] || null;
  }

  getDistinctExercises() {
    const map = new Map();
    for (const item of this.data.sets) {
      const key = item.exercise.trim();
      if (key && !map.has(key.toLowerCase())) {
        map.set(key.toLowerCase(), key);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "id"));
  }

  /**
   * Menduplikasi set dari sesi latihan terakhir (selain hari ini) ke hari ini
   */
  repeatLastSession() {
    const pastSets = this.data.sets
      .filter((item) => item.date !== this.todayKey)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (pastSets.length === 0) {
      return { addedCount: 0, sourceDate: null };
    }

    const lastDate = pastSets[0].date;
    const sessionToCopy = pastSets
      .filter((item) => item.date === lastDate)
      .sort((a, b) => a.timestamp - b.timestamp);

    let addedCount = 0;
    const baseTime = Date.now();

    sessionToCopy.forEach((src, idx) => {
      this.data.sets.push({
        id: `set_${baseTime + idx}_${Math.random().toString(36).slice(2, 6)}`,
        date: this.todayKey,
        timestamp: baseTime + idx,
        muscleGroup: src.muscleGroup,
        exercise: src.exercise,
        weight: src.weight,
        reps: src.reps,
        rir: src.rir
      });
      addedCount += 1;
    });

    saveAppData(this.data);
    return { addedCount, sourceDate: lastDate };
  }

  getTodaySummary() {
    const todaySets = this.getTodaySets();
    const totalSets = todaySets.length;
    const totalVolume = todaySets.reduce((sum, item) => sum + getSetVolume(item), 0);
    const goal = this.data.settings.goal;

    return {
      totalSets,
      totalVolume,
      focusLabel: goal === "bulk" ? "Target Fokus" : "Efisiensi Diet",
      focusValue: goal === "bulk" ? "Overload" : "Defisit Aman"
    };
  }

  /**
   * Menghitung volume beban 7 hari terakhir per kelompok otot
   */
  getWeeklyMuscleVolume() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const totals = {};
    MUSCLE_GROUPS.forEach((mg) => {
      totals[mg] = { muscleGroup: mg, volume: 0, sets: 0 };
    });

    for (const item of this.data.sets) {
      if (item.timestamp >= sevenDaysAgo) {
        const mg = totals[item.muscleGroup] ? item.muscleGroup : "Inti";
        totals[mg].volume += getSetVolume(item);
        totals[mg].sets += 1;
      }
    }

    return Object.values(totals).sort((a, b) => b.volume - a.volume);
  }

  getTodayMeta() {
    return this.data.sessionMeta[this.todayKey] || { bodyWeight: "", note: "" };
  }

  saveTodayMeta({ bodyWeight, note }) {
    this.data.sessionMeta[this.todayKey] = {
      bodyWeight: bodyWeight === "" ? "" : Number(bodyWeight),
      note: (note || "").trim()
    };
    saveAppData(this.data);
  }

  replaceAllData(newData) {
    this.data = newData;
    saveAppData(this.data);
  }

  resetAllData() {
    this.data = clearAppData();
  }
}
