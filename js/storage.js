/**
 * js/storage.js
 * Mengelola penyimpanan data lokal (localStorage), cadangan JSON, dan pemulihan data.
 */
const STORAGE_KEY = "liftforge_gym_tracker_v1";

const DEFAULT_DATA = {
  settings: {
    theme: "dark",       // "dark" | "light"
    accent: "amber",     // "amber" | "emerald" | "cobalt" | "coral"
    goal: "bulk",        // "bulk" (Tambah Massa Otot) | "cut" (Diet)
    defaultRest: 90      // detik
  },
  sets: [],              // { id, date, timestamp, muscleGroup, exercise, weight, reps, rir }
  sessionMeta: {}        // { [dateKey]: { bodyWeight, note } }
};

function createDefaultData() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultData();
      saveAppData(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    const fallback = createDefaultData();

    return {
      settings: {
        ...fallback.settings,
        ...(parsed.settings || {})
      },
      sets: Array.isArray(parsed.sets) ? parsed.sets : [],
      sessionMeta:
        parsed.sessionMeta && typeof parsed.sessionMeta === "object"
          ? parsed.sessionMeta
          : {}
    };
  } catch (err) {
    console.error("Gagal membaca data lokal:", err);
    return createDefaultData();
  }
}

function saveAppData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Gagal menyimpan ke memori lokal:", err);
    return false;
  }
}

function clearAppData() {
  const fresh = createDefaultData();
  saveAppData(fresh);
  return fresh;
}

function exportAppDataJSON(data) {
  const payload = {
    app: "LiftForge",
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement("a");
  link.href = url;
  link.download = `liftforge-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseImportedJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  const candidate = parsed && parsed.data ? parsed.data : parsed;

  if (!candidate || !Array.isArray(candidate.sets)) {
    throw new Error("Format file JSON tidak sesuai dengan struktur LiftForge.");
  }

  const fallback = createDefaultData();
  return {
    settings: {
      ...fallback.settings,
      ...(candidate.settings || {})
    },
    sets: candidate.sets,
    sessionMeta:
      candidate.sessionMeta && typeof candidate.sessionMeta === "object"
        ? candidate.sessionMeta
        : {}
  };
}
