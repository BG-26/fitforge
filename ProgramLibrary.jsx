import { useState, useEffect, useCallback } from "react";

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
const BG      = "#06080C";
const SURFACE = "#0C1018";
const BORDER  = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT    = "#EEF2F8";
const MUTED   = "rgba(238,242,248,0.4)";
const FAINT   = "rgba(238,242,248,0.07)";
const GOLD    = "#F0C060";
const FD      = "'Barlow Condensed', 'Helvetica Neue', sans-serif";
const FB      = "'DM Sans', 'Helvetica Neue', sans-serif";

// ─── STORAGE KEYS ──────────────────────────────────────────────────────────
const ENROLLED_KEY   = "ff_enrolled_program";
const NUDGE_KEY      = "ff_nudge_state";
const SESSIONS_KEY   = "ff_sessions_v2";

// ─── PROGRAM TEMPLATES ─────────────────────────────────────────────────────
export const PROGRAM_TEMPLATES = [
  {
    id: "forge-8w-strength",
    name: "FORGE 8-WEEK",
    subtitle: "STRENGTH FOUNDATION",
    track: "FORGE",
    weeks: 8,
    daysPerWeek: 4,
    color: "#F87171",
    colorDim: "rgba(248,113,113,0.08)",
    gradient: "linear-gradient(135deg,#F87171,#DC2626)",
    icon: "🔩",
    tagline: "Built. Dense. Powerful.",
    description: "Eight weeks of progressive strength-first programming. Heavy compound movements, percentage-based overload, and hypertrophy cycles. You leave a different athlete.",
    phases: [
      { weeks: [1,2], label: "FOUNDATION",    desc: "Movement quality and baseline load" },
      { weeks: [3,4], label: "ACCUMULATION",  desc: "Volume builds — density work" },
      { weeks: [5,6], label: "INTENSIFICATION",desc: "Load increases, volume trims" },
      { weeks: [7],   label: "PEAK",          desc: "Max expression — heavy singles" },
      { weeks: [8],   label: "DELOAD",        desc: "50% volume — flush and recover" },
    ],
    weekTemplate: (week) => ({
      days: [
        { dayNum: 1, focus: "PUSH + CORE",   blueprint: ["PUSH","PUSH","CORE","CORE"] },
        { dayNum: 2, focus: "PULL + HINGE",  blueprint: ["PULL","HINGE","PULL","CORE"] },
        { dayNum: 3, focus: "SQUAT + LUNGE", blueprint: ["SQUAT","LUNGE","SQUAT","CORE"] },
        { dayNum: 4, focus: "FULL COMPOUND", blueprint: ["PUSH","PULL","SQUAT","HINGE"] },
      ],
      intensityNote: week <= 2 ? "Focus on form — 65–70% effort"
        : week <= 4 ? "Volume push — 75–80% effort"
        : week <= 6 ? "Loading phase — 80–87% effort"
        : week === 7 ? "Peak week — leave nothing behind"
        : "Deload — half volume, full range",
    }),
  },
  {
    id: "surge-6w-conditioning",
    name: "SURGE 6-WEEK",
    subtitle: "ATHLETIC CONDITIONING",
    track: "SURGE",
    weeks: 6,
    daysPerWeek: 4,
    color: "#F0C060",
    colorDim: "rgba(240,192,96,0.08)",
    gradient: "linear-gradient(135deg,#F0C060,#D97706)",
    icon: "⚡",
    tagline: "Explosive. Athletic. Conditioned.",
    description: "Six weeks of power-based metabolic training. Functional movements under fatigue, athletic conditioning, explosive capacity. Built for performance.",
    phases: [
      { weeks: [1,2], label: "BASE",        desc: "Aerobic base and movement patterns" },
      { weeks: [3,4], label: "BUILD",       desc: "Intensity climbs — lactate threshold" },
      { weeks: [5],   label: "PEAK",        desc: "Max output — compete with yourself" },
      { weeks: [6],   label: "TAPER",       desc: "Short, sharp — retain fitness" },
    ],
    weekTemplate: (week) => ({
      days: [
        { dayNum: 1, focus: "METCON + PUSH",  blueprint: ["METCON","PUSH","METCON","CORE"] },
        { dayNum: 2, focus: "SQUAT + LUNGE",  blueprint: ["SQUAT","LUNGE","METCON","CORE"] },
        { dayNum: 3, focus: "METCON + PULL",  blueprint: ["METCON","PULL","METCON","CORE"] },
        { dayNum: 4, focus: "FULL CIRCUIT",   blueprint: ["METCON","PUSH","SQUAT","PULL"] },
      ],
      intensityNote: week <= 2 ? "Aerobic pace — you can talk"
        : week <= 4 ? "Push pace — controlled aggression"
        : week === 5 ? "Race pace — empty the tank"
        : "Sharp and short — 60% volume",
    }),
  },
  {
    id: "flow-4w-mobility",
    name: "FLOW 4-WEEK",
    subtitle: "MOBILITY RESET",
    track: "FLOW",
    weeks: 4,
    daysPerWeek: 3,
    color: "#5EEAD4",
    colorDim: "rgba(94,234,212,0.08)",
    gradient: "linear-gradient(135deg,#5EEAD4,#0891B2)",
    icon: "🌊",
    tagline: "Mobile. Fluid. Precise.",
    description: "Four weeks of movement quality work. Mobility, motor control, joint health. The body that lasts.",
    phases: [
      { weeks: [1,2], label: "ASSESS",    desc: "Map your restrictions — find the limits" },
      { weeks: [3],   label: "EXPAND",    desc: "Push range — controlled discomfort" },
      { weeks: [4],   label: "INTEGRATE", desc: "Load the new range — make it yours" },
    ],
    weekTemplate: (week) => ({
      days: [
        { dayNum: 1, focus: "LOWER BODY", blueprint: ["SQUAT","LUNGE","HINGE","CORE"] },
        { dayNum: 2, focus: "UPPER BODY", blueprint: ["PUSH","PULL","CORE","METCON"] },
        { dayNum: 3, focus: "FULL FLOW",  blueprint: ["SQUAT","PUSH","LUNGE","PULL"] },
      ],
      intensityNote: week <= 2 ? "Slow and exploratory — own every position"
        : week === 3 ? "Expand range — spend time at end range"
        : "Add light load to new range — integrate",
    }),
  },
];

// ─── STORAGE HELPERS ───────────────────────────────────────────────────────
export function getEnrolledProgram() {
  try { return JSON.parse(localStorage.getItem(ENROLLED_KEY) || "null"); } catch { return null; }
}

export function saveEnrolledProgram(prog) {
  try { localStorage.setItem(ENROLLED_KEY, JSON.stringify(prog)); } catch {}
}

export function clearEnrolledProgram() {
  try { localStorage.removeItem(ENROLLED_KEY); } catch {}
}

export function getSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]"); } catch { return []; }
}

function getNudgeState() {
  try { return JSON.parse(localStorage.getItem(NUDGE_KEY) || "{}"); } catch { return {}; }
}

function saveNudgeState(state) {
  try { localStorage.setItem(NUDGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── MOTIVATIONAL NUDGE ENGINE ─────────────────────────────────────────────
function computeNudge(user) {
  const sessions = getSessions();
  const nudgeState = getNudgeState();
  const now = Date.now();

  // Find gap since last workout
  const lastSession = sessions[0];
  const gapDays = lastSession
    ? (now - new Date(lastSession.date).getTime()) / 86400000
    : Infinity;

  // Dismiss nudge if dismissed < 12h ago
  const dismissedAt = nudgeState.dismissedAt || 0;
  if (now - dismissedAt < 12 * 3600 * 1000) return null;

  if (gapDays >= 3 && gapDays < 7) {
    return {
      type: "missed_workout",
      urgency: "low",
      icon: "💪",
      headline: `${Math.floor(gapDays)} days since your last session.`,
      body: "Momentum builds in streaks. Get back in today — even 20 minutes counts.",
      cta: "START A SESSION",
    };
  }
  if (gapDays >= 7 && gapDays < 14) {
    return {
      type: "missed_workout",
      urgency: "medium",
      icon: "🔩",
      headline: "A week away from the work.",
      body: `${user?.name || "Athlete"}, your body is asking for it. Don't lose what you've built.`,
      cta: "GET BACK IN",
    };
  }
  if (gapDays >= 14) {
    return {
      type: "missed_workout",
      urgency: "high",
      icon: "🚨",
      headline: "Two weeks off. Time to reset.",
      body: "Every comeback starts with a single session. The engine just needs a spark.",
      cta: "RESTART NOW",
    };
  }
  return null;
}

function dismissNudge() {
  saveNudgeState({ ...getNudgeState(), dismissedAt: Date.now() });
}

// ─── AI WEEK GENERATION ────────────────────────────────────────────────────
async function generateProgramWeek({ program, weekNum, user }) {
  const template = program.weekTemplate(weekNum);
  const day = template.days[0]; // representative day

  const prompt = `You are FitForge's Program AI. Generate a structured training week for an enrolled athlete.

Program: ${program.name} · Week ${weekNum}/${program.weeks}
Track: ${program.track}
Phase: ${program.phases.find(p => p.weeks.includes(weekNum))?.label || "TRAINING"}
Intensity: ${template.intensityNote}
Athlete: ${user?.name || "Athlete"} · Age: ${user?.age || "not specified"} · Limiters: ${user?.limiters?.join(", ") || "none"}
Equipment: ${user?.loadout?.slice(0, 5).join(", ") || "bodyweight"}

Generate a week summary with 2–3 sentences of coaching context for this specific week, and for each training day provide: a session title, primary focus, one key coaching cue, and estimated duration in minutes.

Return ONLY valid JSON:
{
  "weekTitle": "",
  "weekCoachNote": "",
  "days": [
    { "dayNum": 1, "title": "", "focus": "", "keyCue": "", "durationMins": 45 }
  ]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    // Fallback: return template-based data without AI
    return {
      weekTitle: `WEEK ${weekNum} — ${program.phases.find(p => p.weeks.includes(weekNum))?.label || "TRAINING"}`,
      weekCoachNote: template.intensityNote,
      days: template.days.map(d => ({
        dayNum: d.dayNum,
        title: d.focus,
        focus: d.blueprint.join(" → "),
        keyCue: "Quality reps over heavy loads today.",
        durationMins: program.track === "FLOW" ? 35 : 45,
      })),
    };
  }
}

// ─── SESSION HISTORY SECTION ───────────────────────────────────────────────
function SessionHistorySection() {
  const sessions = getSessions().slice(0, 20);

  const trackColor = { FORGE: "#F87171", SURGE: "#F0C060", FLOW: "#5EEAD4" };
  const trackIcon  = { FORGE: "🔩", SURGE: "⚡", FLOW: "🌊" };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const fmtDur = (secs) => {
    if (!secs) return "—";
    const m = Math.floor(secs / 60);
    return `${m}m`;
  };

  if (!sessions.length) return (
    <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER2}` }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
      <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8 }}>NO SESSIONS YET</div>
      <div style={{ fontSize: 13, color: MUTED }}>Complete your first workout to start building history.</div>
    </div>
  );

  // Weekly streak
  const weeklyMap = {};
  sessions.forEach(s => {
    const week = new Date(s.date);
    week.setHours(0,0,0,0);
    week.setDate(week.getDate() - week.getDay());
    const key = week.toISOString();
    if (!weeklyMap[key]) weeklyMap[key] = 0;
    weeklyMap[key]++;
  });
  const weekKeys = Object.keys(weeklyMap).sort().reverse().slice(0, 8);

  return (
    <div>
      {/* Weekly consistency bars */}
      <div style={{ marginBottom: 24, padding: "16px 18px", borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>WEEKLY CONSISTENCY</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 48 }}>
          {weekKeys.map((wk, i) => {
            const count = weeklyMap[wk];
            const maxPossible = 5;
            const h = Math.max(6, Math.round((count / maxPossible) * 44));
            const isThis = i === 0;
            return (
              <div key={wk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: h, borderRadius: 3, background: isThis ? GOLD : "rgba(240,192,96,0.3)", transition: "height 0.6s" }}/>
                <div style={{ fontSize: 9, color: MUTED }}>{count}</div>
              </div>
            );
          })}
          {weekKeys.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No data yet</div>}
        </div>
      </div>

      {/* Session list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((s, i) => {
          const c = trackColor[s.track] || GOLD;
          const ic = trackIcon[s.track] || "💪";
          const effortStars = s.overallEffort ? "●".repeat(Math.min(s.overallEffort, 5)) : "";
          return (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{ic}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{s.track} SESSION</div>
                <div style={{ fontSize: 11, color: MUTED }}>{fmt(s.date)} · {fmtDur(s.duration)} {s.mode ? `· ${s.mode}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {effortStars && <div style={{ fontSize: 9, color: c, letterSpacing: 1, marginBottom: 2 }}>{effortStars}</div>}
                <div style={{ fontSize: 10, color: MUTED }}>{s.slots?.length || 0} slots</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MOTIVATIONAL NUDGE CARD ───────────────────────────────────────────────
function MotivationalNudgeCard({ user, onStartWorkout }) {
  const [nudge, setNudge] = useState(() => computeNudge(user));

  if (!nudge) return null;

  const urgencyColor = nudge.urgency === "high" ? "#F87171" : nudge.urgency === "medium" ? GOLD : "#5EEAD4";

  return (
    <div style={{ marginBottom: 20, padding: "18px 18px", borderRadius: 16, background: SURFACE, border: `1.5px solid ${urgencyColor}40`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: urgencyColor, opacity: 0.6 }}/>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{nudge.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FD, fontSize: 17, fontWeight: 800, color: TEXT, letterSpacing: "0.04em", marginBottom: 5 }}>{nudge.headline}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>{nudge.body}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onStartWorkout} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "none", background: urgencyColor, color: BG, fontFamily: FD, fontSize: 14, fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer" }}>{nudge.cta}</button>
            <button onClick={() => { dismissNudge(); setNudge(null); }} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER2}`, background: "transparent", color: MUTED, fontFamily: FB, fontSize: 12, cursor: "pointer" }}>Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVE PROGRAM SECTION ────────────────────────────────────────────────
function ActiveProgramSection({ enrolled, user, onStartDay, onLeave }) {
  const program = PROGRAM_TEMPLATES.find(p => p.id === enrolled.programId);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentWeek = enrolled.currentWeek || 1;
  const completedDays = enrolled.completedDays || [];
  const phase = program?.phases.find(p => p.weeks.includes(currentWeek));

  useEffect(() => {
    if (!program) return;
    // Load cached week data or generate
    const cacheKey = `ff_week_${enrolled.programId}_w${currentWeek}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached) { setWeekData(cached); return; }
    } catch {}
    setLoading(true);
    generateProgramWeek({ program, weekNum: currentWeek, user })
      .then(data => {
        setWeekData(data);
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      })
      .finally(() => setLoading(false));
  }, [enrolled.programId, currentWeek]);

  if (!program) return null;

  const daysDone = completedDays.filter(d => d.week === currentWeek).length;
  const totalDays = program.daysPerWeek;
  const pct = Math.round((((currentWeek - 1) * totalDays + daysDone) / (program.weeks * totalDays)) * 100);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Program header */}
      <div style={{ padding: "20px 18px", borderRadius: 16, background: program.colorDim, border: `1.5px solid ${program.color}40`, marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: program.gradient }}/>
        <div style={{ paddingLeft: 10 }}>
          <div style={{ fontSize: 10, color: program.color, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>ENROLLED · WEEK {currentWeek}/{program.weeks}</div>
          <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: "0.04em", marginBottom: 4 }}>{program.name}</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>{phase?.label} — {phase?.desc}</div>

          {/* Progress bar */}
          <div style={{ height: 4, background: FAINT, borderRadius: 2, marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: program.gradient, borderRadius: 2, transition: "width 0.8s" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 10, color: MUTED }}>{pct}% complete</div>
            <div style={{ fontSize: 10, color: MUTED }}>{daysDone}/{totalDays} days this week</div>
          </div>
        </div>
      </div>

      {/* This week's days */}
      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: MUTED, fontSize: 13 }}>Generating week {currentWeek}…</div>
      ) : weekData ? (
        <div>
          {weekData.weekCoachNote && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, marginBottom: 12, fontSize: 13, color: MUTED, lineHeight: 1.6, fontStyle: "italic" }}>
              "{weekData.weekCoachNote}"
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(weekData.days || []).map((day) => {
              const done = completedDays.some(d => d.week === currentWeek && d.day === day.dayNum);
              const isNext = !done && !completedDays.some(d => d.week === currentWeek && d.day < day.dayNum && !completedDays.some(dd => dd.week === currentWeek && dd.day === d.day));
              return (
                <div key={day.dayNum} style={{ padding: "14px 16px", borderRadius: 12, background: done ? FAINT : SURFACE, border: `1px solid ${done ? BORDER : BORDER2}`, display: "flex", alignItems: "center", gap: 12, opacity: done ? 0.55 : 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? FAINT : program.colorDim, border: `1.5px solid ${done ? BORDER : program.color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 14, fontWeight: 800, color: done ? MUTED : program.color, flexShrink: 0 }}>
                    {done ? "✓" : day.dayNum}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: done ? MUTED : TEXT, marginBottom: 2 }}>{day.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{day.keyCue}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>{day.durationMins}m</div>
                    {!done && (
                      <button onClick={() => onStartDay(program, currentWeek, day)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: program.color, color: BG, fontFamily: FD, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer" }}>
                        START
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Leave program */}
      <button onClick={onLeave} style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${BORDER2}`, background: "transparent", color: MUTED, fontFamily: FB, fontSize: 12, cursor: "pointer" }}>
        Leave program
      </button>
    </div>
  );
}

// ─── BROWSE PROGRAMS SECTION ───────────────────────────────────────────────
function BrowseProgramsSection({ user, onEnroll }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {PROGRAM_TEMPLATES.map(prog => {
        const isOpen = expanded === prog.id;
        return (
          <div key={prog.id} style={{ borderRadius: 16, background: SURFACE, border: `1px solid ${isOpen ? prog.color + "50" : BORDER2}`, overflow: "hidden", transition: "border-color 0.2s" }}>
            <button onClick={() => setExpanded(isOpen ? null : prog.id)} style={{ width: "100%", padding: "18px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FB }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: prog.colorDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{prog.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: "0.04em", lineHeight: 1.1 }}>{prog.name}</div>
                  <div style={{ fontSize: 11, color: prog.color, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{prog.subtitle}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: MUTED }}>{prog.weeks}w · {prog.daysPerWeek}d/wk</div>
                  <div style={{ fontSize: 11, color: isOpen ? prog.color : MUTED, transition: "color 0.2s" }}>{isOpen ? "▲" : "▼"}</div>
                </div>
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, margin: "14px 0 16px" }}>{prog.description}</p>

                {/* Phases */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>PROGRAM PHASES</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {prog.phases.map((ph, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 50, fontSize: 10, color: prog.color, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0, paddingTop: 2 }}>
                          W{ph.weeks[0]}{ph.weeks.length > 1 ? `–${ph.weeks[ph.weeks.length-1]}` : ""}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{ph.label}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{ph.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => onEnroll(prog)} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: prog.gradient, color: BG, fontFamily: FD, fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer" }}>
                  ENROLL IN {prog.name} →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PROGRAMS TAB (MAIN EXPORT) ────────────────────────────────────────────
export function ProgramsTab({ user, onNavigateToTrain }) {
  const [tab, setTab] = useState("active"); // active | browse | history
  const [enrolled, setEnrolled] = useState(() => getEnrolledProgram());

  const handleEnroll = useCallback((prog) => {
    const newEnrollment = {
      programId: prog.id,
      enrolledAt: new Date().toISOString(),
      currentWeek: 1,
      completedDays: [],
    };
    saveEnrolledProgram(newEnrollment);
    setEnrolled(newEnrollment);
    setTab("active");
  }, []);

  const handleLeave = useCallback(() => {
    if (!window.confirm("Leave this program? Your progress will be lost.")) return;
    clearEnrolledProgram();
    setEnrolled(null);
  }, []);

  const handleStartDay = useCallback((program, week, day) => {
    // Mark day as complete and navigate to train tab with the program's track preselected
    const updated = {
      ...enrolled,
      completedDays: [...(enrolled?.completedDays || []), { week, day: day.dayNum, date: new Date().toISOString() }],
    };
    // Advance week if all days done
    const doneThisWeek = updated.completedDays.filter(d => d.week === week).length;
    if (doneThisWeek >= program.daysPerWeek && week < program.weeks) {
      updated.currentWeek = week + 1;
    }
    saveEnrolledProgram(updated);
    setEnrolled(updated);
    // Navigate to train tab so user can start the actual workout
    onNavigateToTrain?.(program.track);
  }, [enrolled, onNavigateToTrain]);

  const TABS = [
    { id: "active",  label: "MY PROGRAM" },
    { id: "browse",  label: "BROWSE" },
    { id: "history", label: "HISTORY" },
  ];

  return (
    <div style={{ padding: "24px 22px 0" }}>
      <div style={{ fontSize: 10, color: GOLD, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>PROGRAMS</div>
      <h2 style={{ fontFamily: FD, fontSize: 36, fontWeight: 800, letterSpacing: "0.02em", lineHeight: 0.95, marginBottom: 20 }}>Structured<br/>protocols.</h2>

      {/* Motivational nudge */}
      <MotivationalNudgeCard user={user} onStartWorkout={() => onNavigateToTrain?.()} />

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 22, background: SURFACE, borderRadius: 12, padding: 4, border: `1px solid ${BORDER}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 6px", borderRadius: 9, border: "none",
            background: tab === t.id ? GOLD : "transparent",
            color: tab === t.id ? BG : MUTED,
            fontFamily: FD, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em",
            cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "active" && (
        enrolled ? (
          <ActiveProgramSection
            enrolled={enrolled}
            user={user}
            onStartDay={handleStartDay}
            onLeave={handleLeave}
          />
        ) : (
          <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8 }}>NO ACTIVE PROGRAM</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Browse and enroll in a structured program to unlock week-by-week guidance.</div>
            <button onClick={() => setTab("browse")} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: GOLD, color: BG, fontFamily: FD, fontSize: 16, fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer" }}>BROWSE PROGRAMS →</button>
          </div>
        )
      )}

      {tab === "browse" && (
        <BrowseProgramsSection user={user} onEnroll={handleEnroll} />
      )}

      {tab === "history" && <SessionHistorySection />}
    </div>
  );
}
