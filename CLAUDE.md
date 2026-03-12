# FitForge — Claude Code Project Context

## Project
AI-powered fitness app. React + Vite. Running at `http://localhost:5173/`
All source files in `~/Desktop/fitforge/src/`

## Start Dev Server
```bash
cd ~/Desktop/fitforge && npm run dev
```

## Environment Variables
Located at `~/Desktop/fitforge/.env.local`
```
VITE_ANTHROPIC_KEY=...       # Anthropic API — protocol generation, food parsing, coaching
VITE_YOUTUBE_KEY=...         # YouTube Data API v3 — reserved, not currently active
VITE_EXERCISEDB_URL=         # Blank — not in use
```

---

## Source Files

| File | Purpose |
|------|---------|
| `App.jsx` | Main app — all engine logic, onboarding, nav, tabs, protocol screen |
| `WorkoutTimer.jsx` | Stopwatch, rest timer, session recap, post-session check-in |
| `IntervalTimer.jsx` | Full-screen FORGE45 interval timer, protocol-driven |
| `FoodTracker.jsx` | Three-tier nutrition modes, voice input, AI food parser, coach |
| `HealthConnections.jsx` | Apple Health, Garmin, Whoop OAuth stubs |
| `PerformanceEngine.js` | Exercise history, adaptation logic, localStorage (Supabase-ready) |
| `ExercisePreview.jsx` | NOT IN USE — can be deleted |

---

## Design System

```
Background:   #06080C / #0C1018
Gold accent:  #F0C060
Text:         #EEF2F8
Muted:        rgba(238,242,248,0.45)
Surface:      #0C1018
Border:       rgba(255,255,255,0.06)
Border2:      rgba(255,255,255,0.1)

Fonts: Barlow Condensed (display, 700-900) + DM Sans (body, 400-700)
Max width: 500-520px, mobile-first
```

---

## Branding & Terminology

| Term | Meaning |
|------|---------|
| FORGE | Strength track — red #F87171 |
| SURGE | Metabolic track — gold #F0C060 |
| FLOW | Mobility track — cyan #5EEAD4 |
| FX Scores | 5-axis performance profile (Drive, Burst, Engine, Range, Form) |
| Loadout | User's equipment selection |
| FORGE45 | Interval timer format (not "F45" — trademark) |
| Slot | One exercise in the 6-slot protocol |

---

## Track Blueprints

```
FORGE: [PUSH, PULL, SQUAT, HINGE, CORE, PUSH]
SURGE: [METCON, PUSH, SQUAT, PULL, LUNGE, METCON]
FLOW:  [SQUAT, LUNGE, PULL, CORE, PUSH, METCON]
```

---

## Age Tier System

| Tier | Age | Rep Cap | Key Exclusions |
|------|-----|---------|----------------|
| PRIME | 18-34 | 10 | None |
| EXPERIENCED 🔷 | 35-49 | 9 | back squat, deadlift, HSPU |
| MASTERS 🔶 | 50-64 | 7 | + jumps, burpee, box jump |
| ELITE_MASTERS 🔴 | 65+ | 5 | + front squat, BB RDL, assault bike |

---

## AI Model Usage

```
claude-haiku-4-5-20251001   — protocol enrichment, food parsing (cost-efficient)
claude-sonnet-4-20250514    — coaching voice, morning plans, evening recaps
```

All API calls require headers:
```js
"x-api-key": import.meta.env.VITE_ANTHROPIC_KEY
"anthropic-version": "2023-06-01"
"anthropic-dangerous-direct-browser-access": "true"
```

---

## Session Flow

1. User selects track → AI generates 6-slot protocol (Haiku)
2. AI enriches protocol — adds cues, progression tips, warmup, cooldown (Haiku)
3. `▶ START SESSION` → live stopwatch starts
4. Tap slot card to complete → 60s rest timer auto-starts
5. All 6 slots done → SESSION RECAP modal opens
6. Recap: DETAILED (per-exercise logging) or SMART (3-tap check-in)
7. Data saved to PerformanceEngine → adapts next session

---

## Performance Engine (PerformanceEngine.js)

- Stores per-exercise history in localStorage (`ff_perf_v1`)
- Session logs in localStorage (`ff_sessions_v2`)
- Tracking mode preference in localStorage (`ff_tracking_prefs`)
- After 2+ sessions: motivational nudge cards appear on slot cards
- After 2 consecutive struggles: auto-reduces reps 2 counts
- After 2 consecutive easy sessions: auto-increases reps 2 counts
- **Supabase-ready**: swap `saveExerciseLog`, `saveSession`, `getAllPerformance`, `getSessions` functions only

---

## Onboarding Flow (9 steps)

```
0. Name
1. Age → derives Age Tier
2. Body metrics (weight, height, sex, goal)
3. Track selection (FORGE/SURGE/FLOW)
3.5. Nutrition mode (LOGGER/TRACKER/COACH)
4. Loadout (equipment, 31 items + BODYWEIGHT toggle)
5. Limiters (injuries + free text)
6. FX Audit (5-axis questions)
7. FX Profile reveal (radar chart + score bars)
```

---

## Slot Card Features
- Slot type badge + exercise name + sets×reps + rest
- AI cue + progression tip
- Performance nudge (from history, after 2+ sessions)
- `▶ WATCH DEMO` button → opens YouTube search in new tab
- Tap to complete → triggers rest timer

---

## What's Built ✅
- Full onboarding flow
- Protocol generation engine
- Age tier exclusion system
- Ankle + injury limiter exclusions
- Live session stopwatch + rest timer
- FORGE45 interval timer
- Session recap + adaptive check-in (DETAILED/SMART)
- Performance adaptation engine
- FX Profile tab with radar chart
- Food tracker (LOGGER/TRACKER/COACH modes)
- Voice food input
- Health platform connection stubs

---

## What's NOT Built Yet ❌

### High Priority
- **Exercise video library** — plan: host 8-15s demo clips on Supabase Storage or Vercel Blob, stream via URL stored in exercise library. Component not built yet.
- **Supabase integration** — replace 4 localStorage functions in PerformanceEngine.js
- **GitHub repo** — not created yet
- **Vercel deployment** — not done yet

### Medium Priority
- Programs tab — empty, needs SessionHistory + ProgramLibrary wired in
- FX Profile re-audit CTA after 8 sessions
- Recovery banner in Train tab when health data present

### Future
- Payment / Pro tier unlock
- Real OAuth for Health platform connections
- Push notifications
- Streak system
- Social / friend challenges

---

## Known Issues
- `ExercisePreview.jsx` exists in src but is not imported anywhere — safe to delete
- `VITE_EXERCISEDB_URL` is blank in .env.local — not used, ignore
- YouTube key in .env.local — reserved for future use, not active

---

## Vercel ExerciseDB Instance
Deployed at `exercisedb-api-zeta-sandy.vercel.app` but returning 404 — wrong repo was deployed (empty shell). Not in use. Can be redeployed or ignored.
