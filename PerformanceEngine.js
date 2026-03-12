// ─── FITFORGE PERFORMANCE ENGINE ─────────────────────────────────────────────
// Tracks per-exercise performance, adapts future protocols, stores history.
// Designed to work with localStorage now, Supabase later.

const STORE_KEY  = "ff_perf_v1";   // exercise performance history
const SESSION_KEY = "ff_sessions_v2"; // session logs
const PREFS_KEY  = "ff_tracking_prefs"; // user tracking mode preference

// ─── TRACKING MODES ──────────────────────────────────────────────────────────
export const TRACKING_MODES = {
  DETAILED: {
    id: "DETAILED",
    label: "Full Tracking",
    icon: "📊",
    desc: "Log every set — reps, weight, effort. Full history.",
    color: "#F87171",
  },
  SMART: {
    id: "SMART",
    label: "Smart Mode",
    icon: "🧠",
    desc: "Quick 3-tap check-in. App adapts automatically.",
    color: "#F0C060",
  },
};

// ─── STORAGE LAYER ────────────────────────────────────────────────────────────
// These will be swapped for Supabase calls later — same interface.

export function getTrackingMode() {
  try { return localStorage.getItem(PREFS_KEY) || "SMART"; } catch { return "SMART"; }
}
export function setTrackingMode(mode) {
  try { localStorage.setItem(PREFS_KEY, mode); } catch {}
}

export function getAllPerformance() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
}

export function getExerciseHistory(exerciseId) {
  const all = getAllPerformance();
  return all[exerciseId] || [];
}

export function saveExerciseLog(exerciseId, log) {
  // log: { date, prescribed: {sets,reps}, actual: {sets,reps,weight}, effort, status, notes }
  try {
    const all = getAllPerformance();
    if (!all[exerciseId]) all[exerciseId] = [];
    all[exerciseId].unshift({ ...log, date: new Date().toISOString() });
    all[exerciseId] = all[exerciseId].slice(0, 50); // keep last 50 per exercise
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch(e) {}
}

export function saveSession(session) {
  // session: { date, track, duration, slots, overallEffort, overallFeel, notes, mode }
  try {
    const existing = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
    existing.unshift({ ...session, date: new Date().toISOString() });
    localStorage.setItem(SESSION_KEY, JSON.stringify(existing.slice(0, 200)));
  } catch(e) {}
}

export function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "[]"); } catch { return []; }
}

// ─── ADAPTATION ENGINE ────────────────────────────────────────────────────────

// Analyse history for one exercise and return an adaptation recommendation
export function getAdaptation(exerciseId, prescribed) {
  const history = getExerciseHistory(exerciseId);
  if (history.length < 2) return null; // need at least 2 data points

  const recent = history.slice(0, 3); // last 3 sessions

  // Smart mode: use effort/status signals
  const smartSignals = recent.filter(h => h.effort !== undefined);
  if (smartSignals.length >= 2) {
    const avgEffort = smartSignals.reduce((a,b) => a + (b.effort||2), 0) / smartSignals.length;
    const anyStruggled = smartSignals.some(h => h.status === "partial" || h.status === "skipped");
    const allEasy = smartSignals.every(h => h.effort <= 1);

    if (anyStruggled && smartSignals.filter(h => h.status === "partial" || h.status === "skipped").length >= 2) {
      return { type: "reduce", message: null }; // we'll generate message with AI context
    }
    if (allEasy) {
      return { type: "increase", message: null };
    }
    return { type: "maintain", message: null };
  }

  // Detailed mode: compare actual vs prescribed reps
  const detailedLogs = recent.filter(h => h.actual?.reps !== undefined);
  if (detailedLogs.length >= 2) {
    const parseReps = r => {
      if (!r) return 0;
      const nums = String(r).match(/\d+/g);
      return nums ? Math.round(nums.reduce((a,b) => +a + +b, 0) / nums.length) : 0;
    };

    const targetReps = parseReps(prescribed?.reps);
    const avgActual = detailedLogs.reduce((a,b) => a + parseReps(b.actual?.reps), 0) / detailedLogs.length;
    const completionRate = targetReps > 0 ? avgActual / targetReps : 1;

    if (completionRate < 0.7) return { type: "reduce", completionRate };
    if (completionRate >= 1.0 && detailedLogs.every(h => h.effort <= 1)) return { type: "increase", completionRate };
    return { type: "maintain", completionRate };
  }

  return null;
}

// Generate a motivational nudge message for a slot based on history
export function getNudge(exerciseId, prescribed) {
  const history = getExerciseHistory(exerciseId);
  if (!history.length) return null;

  const last = history[0];
  const adaptation = getAdaptation(exerciseId, prescribed);
  if (!adaptation) return null;

  const name = last.exerciseName || exerciseId;

  if (adaptation.type === "reduce") {
    const msgs = [
      `Last time ${name} was tough — that means it's working. Take what you need today.`,
      `You pushed hard on ${name} last session. No shame in dialing back — consistency beats heroics.`,
      `${name} challenged you recently. Today, focus on form over reps. Quality is progress.`,
    ];
    return { type: "encourage", text: msgs[Math.floor(Math.random() * msgs.length)], icon: "💪" };
  }

  if (adaptation.type === "increase") {
    const msgs = [
      `${name} felt easy last time — time to push harder. You've got more in the tank.`,
      `You've been crushing ${name}. Ready to level up today?`,
      `Last ${name} session: barely broke a sweat. Let's make today count.`,
    ];
    return { type: "push", text: msgs[Math.floor(Math.random() * msgs.length)], icon: "⚡" };
  }

  if (last.status === "partial") {
    const msgs = [
      `Last session you got partway through ${name} — that's still progress. One more rep than last time.`,
      `You made it count on ${name} even when it got hard. Same energy today.`,
    ];
    return { type: "encourage", text: msgs[Math.floor(Math.random() * msgs.length)], icon: "🔥" };
  }

  return null;
}

// Apply adaptations to a protocol's slots (called before generating)
export function applyAdaptations(slots) {
  return slots.map(slot => {
    const id = slot.id || slot.exerciseId || slugify(slot.exercise || slot.exerciseName || "");
    const adaptation = getAdaptation(id, { reps: slot.reps, sets: slot.sets });
    if (!adaptation) return slot;

    const parseRepsRange = r => {
      if (!r) return [8, 12];
      const nums = String(r).match(/\d+/g);
      return nums?.length >= 2 ? [+nums[0], +nums[1]] : nums ? [+nums[0], +nums[0]] : [8, 12];
    };

    const [lo, hi] = parseRepsRange(slot.reps);

    if (adaptation.type === "reduce") {
      const newLo = Math.max(1, lo - 2);
      const newHi = Math.max(newLo + 1, hi - 2);
      return { ...slot, reps: `${newLo}–${newHi}`, _adapted: "reduced" };
    }
    if (adaptation.type === "increase") {
      const newLo = lo + 2;
      const newHi = hi + 2;
      return { ...slot, reps: `${newLo}–${newHi}`, _adapted: "increased" };
    }
    return slot;
  });
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function parseRepsForDisplay(reps) {
  if (!reps) return { lo: 8, hi: 12, isTime: false };
  const s = String(reps);
  if (s.includes("s") || s.includes("min")) return { lo: 0, hi: 0, isTime: true, raw: s };
  const nums = s.match(/\d+/g);
  if (!nums) return { lo: 8, hi: 12, isTime: false };
  return { lo: +nums[0], hi: nums[1] ? +nums[1] : +nums[0], isTime: false };
}
