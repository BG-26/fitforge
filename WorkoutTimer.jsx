import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS (mirror App.jsx) ──────────────────────────────────────────
const BG = "#06080C";
const SURFACE = "#0C1018";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#EEF2F8";
const MUTED = "rgba(238,242,248,0.4)";
const FAINT = "rgba(238,242,248,0.07)";
const FD = "'Barlow Condensed', 'Helvetica Neue', sans-serif";
const FB = "'DM Sans', 'Helvetica Neue', sans-serif";

// ─── FORMAT DEFINITIONS ───────────────────────────────────────────────────────
export const FORMATS = {
  STRENGTH: {
    id: "STRENGTH", name: "Strength", icon: "🔩",
    desc: "Sets × reps with full rest between sets",
    timed: false,
    color: "#F87171",
  },
  CIRCUIT: {
    id: "CIRCUIT", name: "Circuit", icon: "🔄",
    desc: "Move station to station with minimal rest. F45-style.",
    timed: true,
    color: "#F0C060",
    defaultWork: 40, defaultRest: 20, defaultRounds: 3,
  },
  AMRAP: {
    id: "AMRAP", name: "AMRAP", icon: "♾",
    desc: "As many rounds as possible in a set time window.",
    timed: true,
    color: "#FB923C",
    defaultWork: 600, defaultRest: 0, defaultRounds: 1, // 10 min
  },
  EMOM: {
    id: "EMOM", name: "EMOM", icon: "⏱",
    desc: "Every minute on the minute — complete reps, rest what's left.",
    timed: true,
    color: "#A78BFA",
    defaultWork: 40, defaultRest: 20, defaultRounds: 10,
  },
  TABATA: {
    id: "TABATA", name: "Tabata", icon: "⚡",
    desc: "20 seconds on, 10 seconds off × 8 rounds per exercise.",
    timed: true,
    color: "#5EEAD4",
    defaultWork: 20, defaultRest: 10, defaultRounds: 8,
  },
};

// Age-aware format modifications
export function applyFormatAgeMod(format, ageTier, ageOverride) {
  if (!format.timed || !ageTier || ageOverride || ageTier.id === "PRIME") return format;

  const mods = {
    EXPERIENCED: { workMult: 1.0, restMult: 1.25, roundsMod: 0 },
    MASTERS:     { workMult: 0.85, restMult: 1.5,  roundsMod: -1 },
    ELITE_MASTERS: { workMult: 0.7, restMult: 2.0, roundsMod: -2 },
  };
  const m = mods[ageTier.id];
  if (!m) return format;

  return {
    ...format,
    defaultWork: Math.round(format.defaultWork * m.workMult),
    defaultRest: Math.max(10, Math.round(format.defaultRest * m.restMult)),
    defaultRounds: Math.max(1, (format.defaultRounds || 1) + m.roundsMod),
    _ageModified: true,
    _ageTier: ageTier.label,
  };
}

// ─── INTERVAL TIMER COMPONENT ─────────────────────────────────────────────────
// Full-screen takeover. Shows current exercise, countdown, phase (WORK/REST/ROUND).
// Voice command support via Web Speech API.
export function IntervalTimer({ exercises, format, ageTier, ageOverride, onComplete, onClose, trackColor }) {
  const COLOR = trackColor || "#F0C060";
  const adjFormat = applyFormatAgeMod(format, ageTier, ageOverride);

  const isAMRAP = format.id === "AMRAP";

  // State
  const [phase, setPhase] = useState("preview"); // preview | work | rest | roundbreak | done
  const [timeLeft, setTimeLeft] = useState(adjFormat.defaultWork);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");

  const totalRounds = adjFormat.defaultRounds || 1;
  const workTime = adjFormat.defaultWork;
  const restTime = adjFormat.defaultRest;
  const totalExercises = exercises.length;

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Format seconds as MM:SS
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // Tick logic
  const tick = useCallback(() => {
    setTimeLeft(t => {
      if (t <= 1) {
        // Transition to next phase
        if (phase === "work") {
          if (isAMRAP) {
            setPhase("done");
            return 0;
          }
          if (restTime > 0) {
            setPhase("rest");
            return restTime;
          } else {
            // No rest — advance exercise
            advanceExercise();
            return workTime;
          }
        } else if (phase === "rest") {
          advanceExercise();
          return workTime;
        }
        return 0;
      }
      return t - 1;
    });
  }, [phase, restTime, workTime, isAMRAP]);

  function advanceExercise() {
    setCurrentExIdx(idx => {
      const next = idx + 1;
      if (next >= totalExercises) {
        // End of round
        setCurrentRound(r => {
          const nextRound = r + 1;
          if (nextRound > totalRounds) {
            setPhase("done");
            setCompletedRounds(r);
            return r;
          }
          setCompletedRounds(r);
          setPhase("roundbreak");
          setTimeout(() => setPhase("work"), 3000);
          return nextRound;
        });
        return 0;
      }
      setPhase("work");
      setTimeLeft(workTime);
      return next;
    });
  }

  useEffect(() => {
    if (phase === "preview" || phase === "done" || phase === "roundbreak" || isPaused) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, isPaused, tick]);

  // Voice commands
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceStatus("Voice not supported"); return; }
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      const cmd = e.results[e.results.length-1][0].transcript.toLowerCase().trim();
      setVoiceStatus(`"${cmd}"`);
      if (cmd.includes("start") || cmd.includes("go") || cmd.includes("begin")) {
        setIsPaused(false);
        if (phase === "preview") setPhase("work");
      } else if (cmd.includes("stop") || cmd.includes("pause")) {
        setIsPaused(p => !p);
      } else if (cmd.includes("skip") || cmd.includes("next")) {
        advanceExercise();
      } else if (cmd.includes("rest") || cmd.includes("done")) {
        if (phase === "work") { setPhase("rest"); setTimeLeft(restTime); }
      }
      setTimeout(() => setVoiceStatus(""), 2000);
    };
    r.onerror = () => { setVoiceActive(false); setVoiceStatus(""); };
    r.onend = () => setVoiceActive(false);
    recognitionRef.current = r;
    r.start();
    setVoiceActive(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setVoiceActive(false);
  };

  const currentEx = exercises[currentExIdx];
  const progress = isAMRAP ? 0 : ((workTime - timeLeft) / workTime);
  const totalProgress = isAMRAP ? 0 : ((currentRound - 1 + (currentExIdx / totalExercises)) / totalRounds);

  const phaseConfig = {
    preview: { label: "GET READY", bg: SURFACE, accent: COLOR },
    work:    { label: "WORK",  bg: `${COLOR}12`, accent: COLOR },
    rest:    { label: "REST",  bg: "rgba(94,234,212,0.08)", accent: "#5EEAD4" },
    roundbreak: { label: `ROUND ${currentRound}`, bg: "rgba(240,192,96,0.08)", accent: "#F0C060" },
    done:    { label: "DONE", bg: "rgba(52,211,153,0.08)", accent: "#34D399" },
  };
  const pc = phaseConfig[phase] || phaseConfig.work;

  const circleR = 90;
  const circleC = 110;
  const circumference = 2 * Math.PI * circleR;
  const strokeDash = phase === "work" ? circumference * (1 - progress) :
                     phase === "rest" ? circumference * (timeLeft / restTime) : circumference;

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,
      background:BG,fontFamily:FB,color:TEXT,
      display:"flex",flexDirection:"column",
      animation:"fadeIn 0.25s ease"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
        *{box-sizing:border-box}
      `}</style>

      {/* Top bar */}
      <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${BORDER2}`}}>
        <div>
          <div style={{fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.08em",color:TEXT}}>{format.icon} {format.name}</div>
          {adjFormat._ageModified && (
            <div style={{fontSize:10,color:ageTier.color,fontWeight:600,marginTop:2}}>{ageTier.icon} {ageTier.label} modified</div>
          )}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {/* Voice button */}
          <button onClick={voiceActive ? stopVoice : startVoice} style={{
            padding:"8px 12px",borderRadius:10,
            background:voiceActive?"rgba(248,113,113,0.15)":FAINT,
            border:`1px solid ${voiceActive?"#F87171":BORDER2}`,
            color:voiceActive?"#F87171":MUTED,
            cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:600,
            display:"flex",alignItems:"center",gap:6
          }}>
            {voiceActive ? "🎙 ON" : "🎙 Voice"}
          </button>
          <button onClick={onClose} style={{padding:"8px 14px",borderRadius:10,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13}}>✕</button>
        </div>
      </div>

      {voiceStatus && (
        <div style={{textAlign:"center",padding:"6px",background:"rgba(255,255,255,0.04)",fontSize:12,color:MUTED}}>
          Heard: {voiceStatus}
        </div>
      )}

      {/* Overall progress bar */}
      {!isAMRAP && (
        <div style={{height:3,background:FAINT}}>
          <div style={{height:"100%",width:`${totalProgress*100}%`,background:COLOR,transition:"width 0.5s ease"}}/>
        </div>
      )}

      {/* Main content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 24px",maxWidth:480,margin:"0 auto",width:"100%"}}>

        {/* PREVIEW PHASE */}
        {phase === "preview" && (
          <div style={{textAlign:"center",animation:"pop 0.3s ease"}}>
            <div style={{fontSize:48,marginBottom:16}}>{format.icon}</div>
            <div style={{fontFamily:FD,fontSize:36,fontWeight:800,letterSpacing:"0.04em",color:COLOR,marginBottom:8}}>{format.name.toUpperCase()}</div>
            <div style={{fontSize:14,color:MUTED,lineHeight:1.6,marginBottom:24,maxWidth:320}}>{format.desc}</div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:28,width:"100%"}}>
              {[
                {label:"Work", value: isAMRAP ? fmt(workTime) : `${workTime}s`},
                {label:"Rest", value: restTime ? `${restTime}s` : "—"},
                {label:"Rounds", value: isAMRAP ? "1" : `${totalRounds}`},
              ].map(s=>(
                <div key={s.label} style={{padding:"14px 10px",borderRadius:12,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
                  <div style={{fontFamily:FD,fontSize:26,fontWeight:800,color:COLOR,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:10,color:MUTED,marginTop:4,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.label}</div>
                </div>
              ))}
            </div>

            {adjFormat._ageModified && (
              <div style={{padding:"12px 16px",borderRadius:12,background:`${ageTier.color}0C`,border:`1px solid ${ageTier.color}25`,marginBottom:20,textAlign:"left"}}>
                <div style={{fontSize:11,color:ageTier.color,fontWeight:700,marginBottom:4}}>{ageTier.icon} {ageTier.label} modifications active</div>
                <div style={{fontSize:12,color:MUTED}}>Work reduced, rest extended for recovery. Voice commands available.</div>
              </div>
            )}

            <div style={{marginBottom:20,width:"100%"}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>EXERCISES ({exercises.length})</div>
              {exercises.map((ex,i)=>(
                <div key={i} style={{padding:"9px 14px",borderRadius:10,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{ex.exerciseName || ex.name}</span>
                  <span style={{fontSize:11,color:MUTED}}>{ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ""}</span>
                </div>
              ))}
            </div>

            <button onClick={()=>setPhase("work")} style={{
              width:"100%",padding:"20px",borderRadius:16,border:"none",
              background:COLOR,color:BG,fontFamily:FD,fontSize:24,fontWeight:800,
              letterSpacing:"0.08em",cursor:"pointer",
              boxShadow:`0 8px 32px ${COLOR}40`
            }}>
              START SESSION →
            </button>
            <div style={{marginTop:12,fontSize:12,color:MUTED}}>Or say "start" or "go"</div>
          </div>
        )}

        {/* ACTIVE PHASES: work / rest */}
        {(phase === "work" || phase === "rest") && (
          <div style={{textAlign:"center",width:"100%"}}>

            {/* Phase label */}
            <div style={{
              fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.2em",
              color:pc.accent,marginBottom:24,
              animation: phase==="work" ? "pulse 1s ease infinite" : "none"
            }}>{pc.label}</div>

            {/* Exercise name — large */}
            <div style={{fontFamily:FD,fontSize:32,fontWeight:800,letterSpacing:"0.02em",color:TEXT,lineHeight:1.1,marginBottom:8,minHeight:80,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {phase === "rest" && currentExIdx + 1 < totalExercises
                ? <span>↓ <span style={{color:pc.accent}}>{exercises[currentExIdx+1]?.exerciseName || exercises[currentExIdx+1]?.name}</span> next</span>
                : currentEx?.exerciseName || currentEx?.name}
            </div>

            {phase === "work" && currentEx?.cue && (
              <div style={{fontSize:13,color:MUTED,lineHeight:1.5,marginBottom:24,minHeight:40}}>{currentEx.cue}</div>
            )}

            {/* Circular timer */}
            <div style={{position:"relative",width:220,height:220,margin:"0 auto 28px"}}>
              <svg width={220} height={220} viewBox="0 0 220 220" style={{transform:"rotate(-90deg)"}}>
                <circle cx={circleC} cy={circleC} r={circleR} fill="none" stroke={FAINT} strokeWidth="8"/>
                <circle cx={circleC} cy={circleC} r={circleR} fill="none"
                  stroke={pc.accent} strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - strokeDash}
                  strokeLinecap="round"
                  style={{transition:"stroke-dashoffset 0.9s linear"}}
                />
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontFamily:FD,fontSize:56,fontWeight:800,color:TEXT,lineHeight:1,letterSpacing:"-0.02em"}}>{fmt(timeLeft)}</div>
                <div style={{fontSize:11,color:MUTED,marginTop:4,letterSpacing:"0.08em"}}>
                  {isAMRAP ? "REMAINING" : `${currentExIdx+1}/${totalExercises} · R${currentRound}/${totalRounds}`}
                </div>
              </div>
            </div>

            {/* Controls — large touch targets */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,width:"100%"}}>
              <button onClick={()=>setTimeLeft(t=>Math.max(0,t-10))} style={{
                padding:"18px 0",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,
                color:MUTED,cursor:"pointer",fontFamily:FD,fontSize:20,fontWeight:800
              }}>−10s</button>

              <button onClick={()=>setIsPaused(p=>!p)} style={{
                padding:"18px 0",borderRadius:14,border:"none",
                background:isPaused?COLOR:SURFACE,
                color:isPaused?BG:MUTED,
                cursor:"pointer",fontFamily:FD,fontSize:28,fontWeight:800,
                boxShadow:isPaused?`0 4px 20px ${COLOR}40`:"none",
                transition:"all 0.2s"
              }}>{isPaused ? "▶" : "⏸"}</button>

              <button onClick={advanceExercise} style={{
                padding:"18px 0",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,
                color:MUTED,cursor:"pointer",fontFamily:FD,fontSize:20,fontWeight:800
              }}>SKIP →</button>
            </div>

            {/* Quick rest / done buttons */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}>
              {phase==="work" && restTime>0 && (
                <button onClick={()=>{setPhase("rest");setTimeLeft(restTime);}} style={{
                  padding:"14px",borderRadius:12,background:"rgba(94,234,212,0.1)",border:"1px solid rgba(94,234,212,0.3)",
                  color:"#5EEAD4",cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800
                }}>TAKE REST</button>
              )}
              <button onClick={advanceExercise} style={{
                padding:"14px",borderRadius:12,background:`${COLOR}12`,border:`1px solid ${COLOR}30`,
                color:COLOR,cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800,
                gridColumn: (phase==="work" && restTime>0) ? "auto" : "1 / -1"
              }}>DONE ✓</button>
            </div>
          </div>
        )}

        {/* ROUND BREAK */}
        {phase === "roundbreak" && (
          <div style={{textAlign:"center",animation:"pop 0.3s ease"}}>
            <div style={{fontSize:64,marginBottom:16}}>💪</div>
            <div style={{fontFamily:FD,fontSize:40,fontWeight:800,color:COLOR,letterSpacing:"0.04em",marginBottom:8}}>
              ROUND {currentRound - 1} DONE
            </div>
            <div style={{fontSize:14,color:MUTED,marginBottom:24}}>{totalRounds - currentRound + 1} round{totalRounds-currentRound+1!==1?"s":""} remaining</div>
            <div style={{fontSize:13,color:MUTED}}>Round {currentRound} starting in 3 seconds…</div>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div style={{textAlign:"center",animation:"pop 0.35s ease",width:"100%"}}>
            <div style={{fontSize:64,marginBottom:16}}>🏁</div>
            <div style={{fontFamily:FD,fontSize:42,fontWeight:800,color:"#34D399",letterSpacing:"0.04em",marginBottom:8}}>SESSION COMPLETE</div>
            <div style={{fontSize:14,color:MUTED,marginBottom:28}}>
              {isAMRAP ? "Time's up — log your rounds below." : `${completedRounds} round${completedRounds!==1?"s":""} · ${exercises.length} exercises`}
            </div>
            {isAMRAP && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:13,color:MUTED,marginBottom:10}}>How many full rounds did you complete?</div>
                <div style={{display:"flex",justifyContent:"center",gap:10}}>
                  {[1,2,3,4,5,6,7,8].map(n=>(
                    <button key={n} onClick={()=>setCompletedRounds(n)} style={{
                      width:44,height:44,borderRadius:10,border:`1.5px solid ${completedRounds===n?"#34D399":BORDER2}`,
                      background:completedRounds===n?"rgba(52,211,153,0.15)":SURFACE,
                      color:completedRounds===n?"#34D399":MUTED,
                      cursor:"pointer",fontFamily:FD,fontSize:20,fontWeight:800
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={()=>onComplete({ format: format.id, rounds: completedRounds, exercises: exercises.length })} style={{
              width:"100%",padding:"20px",borderRadius:16,border:"none",
              background:"#34D399",color:BG,fontFamily:FD,fontSize:22,fontWeight:800,
              letterSpacing:"0.08em",cursor:"pointer",boxShadow:"0 8px 32px rgba(52,211,153,0.35)"
            }}>
              CHECK IN →
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      {(phase === "work" || phase === "rest") && (
        <div style={{padding:"12px 20px",borderTop:`1px solid ${BORDER2}`,textAlign:"center",fontSize:11,color:MUTED}}>
          Voice: say "pause", "skip", "rest", or "done"
        </div>
      )}
    </div>
  );
}

// ─── POST-SESSION CHECK-IN ─────────────────────────────────────────────────────
// Progressive: quick 3-tap first, expandable to full debrief.
export function PostSessionCheckin({ session, user, onComplete, trackColor }) {
  const COLOR = trackColor || "#F0C060";
  const [phase, setPhase] = useState("quick"); // quick | detail | done
  const [effort, setEffort] = useState(null);       // 1–5
  const [completion, setCompletion] = useState(null); // "all" | "mostly" | "partial" | "scaled"
  const [painAreas, setPainAreas] = useState([]);
  const [energyIn, setEnergyIn] = useState(null);  // 1–5
  const [energyOut, setEnergyOut] = useState(null);
  const [notes, setNotes] = useState("");
  const [expandDetail, setExpandDetail] = useState(false);

  const BODY_AREAS = [
    {id:"lower_back",label:"Lower Back"},{id:"knee",label:"Knee"},
    {id:"shoulder",label:"Shoulder"},{id:"hip",label:"Hip"},
    {id:"wrist",label:"Wrist"},{id:"ankle",label:"Ankle"},
    {id:"neck",label:"Neck"},{id:"elbow",label:"Elbow"},
    {id:"chest",label:"Chest"},{id:"hamstring",label:"Hamstring"},
  ];

  const EFFORT_LABELS = ["","Very Easy","Easy","Moderate","Hard","Max Effort"];
  const COMPLETION_OPTS = [
    {id:"all",label:"Completed all reps",icon:"✅"},
    {id:"mostly",label:"Mostly — minor misses",icon:"🟡"},
    {id:"partial",label:"Partial — took shortcuts",icon:"🟠"},
    {id:"scaled",label:"Scaled significantly",icon:"🔵"},
  ];

  const submitQuick = () => {
    if (!effort || !completion) return;
    setPhase("detail");
  };

  const submitFull = () => {
    const checkin = {
      sessionId: session?.id || Date.now(),
      timestamp: Date.now(),
      date: new Date().toISOString(),
      format: session?.format,
      track: session?.track,
      effort,
      completion,
      painAreas,
      energyIn,
      energyOut,
      notes,
      // Adaptive flags for next protocol generation
      flags: {
        reduceLoad: effort >= 5 && completion !== "all",
        addRest: effort >= 4,
        flagPain: painAreas.length > 0,
        newPainAreas: painAreas.filter(a => !user.limiters?.includes(a)),
      }
    };

    // Save to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem("ff_sessions") || "[]");
      existing.unshift(checkin);
      localStorage.setItem("ff_sessions", JSON.stringify(existing.slice(0, 200)));
    } catch {}

    onComplete(checkin);
  };

  const quickReady = effort !== null && completion !== null;

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,background:BG,
      fontFamily:FB,color:TEXT,display:"flex",flexDirection:"column",
      animation:"fadeIn 0.3s ease",overflowY:"auto"
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>

      <div style={{maxWidth:500,margin:"0 auto",width:"100%",padding:"28px 22px"}}>

        {/* QUICK PHASE */}
        {phase === "quick" && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>SESSION CHECK-IN</div>
            <h2 style={{fontFamily:FD,fontSize:36,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:6}}>How did that<br/><span style={{color:COLOR}}>feel, {user.name}?</span></h2>
            <p style={{color:MUTED,fontSize:13,lineHeight:1.7,marginBottom:28}}>Quick check — 3 taps. This teaches the engine your response to this session.</p>

            {/* Effort */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>EFFORT LEVEL</div>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setEffort(n)} style={{
                    flex:1,padding:"20px 0",borderRadius:14,border:`1.5px solid ${effort===n?COLOR:BORDER2}`,
                    background:effort===n?`${COLOR}15`:SURFACE,
                    color:effort===n?COLOR:MUTED,
                    cursor:"pointer",fontFamily:FD,fontSize:28,fontWeight:800,
                    transition:"all 0.15s"
                  }}>{n}</button>
                ))}
              </div>
              {effort && <div style={{textAlign:"center",fontSize:12,color:COLOR,fontWeight:600,marginTop:8}}>{EFFORT_LABELS[effort]}</div>}
            </div>

            {/* Completion */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>COMPLETION</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {COMPLETION_OPTS.map(o=>(
                  <button key={o.id} onClick={()=>setCompletion(o.id)} style={{
                    padding:"14px 16px",borderRadius:12,border:`1.5px solid ${completion===o.id?COLOR:BORDER2}`,
                    background:completion===o.id?`${COLOR}12`:SURFACE,
                    color:completion===o.id?COLOR:MUTED,
                    cursor:"pointer",fontFamily:FB,fontSize:13,fontWeight:completion===o.id?700:400,
                    display:"flex",alignItems:"center",gap:10,textAlign:"left",transition:"all 0.15s"
                  }}>
                    <span style={{fontSize:18}}>{o.icon}</span> {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anything hurt? — quick toggle */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>ANYTHING HURT?</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {BODY_AREAS.slice(0,6).map(a=>{
                  const active=painAreas.includes(a.id);
                  return (
                    <button key={a.id} onClick={()=>setPainAreas(prev=>prev.includes(a.id)?prev.filter(x=>x!==a.id):[...prev,a.id])} style={{
                      padding:"8px 14px",borderRadius:10,
                      border:`1.5px solid ${active?"#F87171":BORDER2}`,
                      background:active?"rgba(248,113,113,0.1)":SURFACE,
                      color:active?"#F87171":MUTED,
                      cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:active?700:400,
                      transition:"all 0.15s"
                    }}>{active?"🔴":"⭕"} {a.label}</button>
                  );
                })}
              </div>
            </div>

            <button disabled={!quickReady} onClick={submitQuick} style={{
              width:"100%",padding:"17px",borderRadius:14,border:"none",
              background:quickReady?COLOR:FAINT,
              color:quickReady?BG:MUTED,
              fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
              cursor:quickReady?"pointer":"not-allowed",transition:"all 0.2s",
              boxShadow:quickReady?`0 6px 24px ${COLOR}30`:"none"
            }}>
              CONTINUE →
            </button>
          </div>
        )}

        {/* DETAIL PHASE */}
        {phase === "detail" && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>FULL DEBRIEF</div>
            <h2 style={{fontFamily:FD,fontSize:32,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:20}}>A bit more<br/><span style={{color:COLOR}}>detail.</span></h2>

            {/* Energy in/out */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
              {[{label:"Energy coming IN",state:energyIn,setter:setEnergyIn},{label:"Energy going OUT",state:energyOut,setter:setEnergyOut}].map(({label,state,setter})=>(
                <div key={label}>
                  <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8,lineHeight:1.4}}>{label}</div>
                  <div style={{display:"flex",gap:5}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setter(n)} style={{
                        flex:1,padding:"10px 0",borderRadius:8,
                        border:`1px solid ${state===n?COLOR:BORDER2}`,
                        background:state===n?`${COLOR}12`:SURFACE,
                        color:state===n?COLOR:MUTED,
                        cursor:"pointer",fontFamily:FD,fontSize:18,fontWeight:800,transition:"all 0.15s"
                      }}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* All body areas */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>PAIN / DISCOMFORT</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {BODY_AREAS.map(a=>{
                  const active=painAreas.includes(a.id);
                  return (
                    <button key={a.id} onClick={()=>setPainAreas(prev=>prev.includes(a.id)?prev.filter(x=>x!==a.id):[...prev,a.id])} style={{
                      padding:"7px 12px",borderRadius:10,
                      border:`1.5px solid ${active?"#F87171":BORDER2}`,
                      background:active?"rgba(248,113,113,0.1)":SURFACE,
                      color:active?"#F87171":MUTED,
                      cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:active?700:400,transition:"all 0.15s"
                    }}>{active?"🔴":"⭕"} {a.label}</button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>NOTES</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything to note — felt strong on squats, shoulder clicked on press, increased weight on RDL…" rows={3} style={{width:"100%",background:SURFACE,border:`1.5px solid ${BORDER2}`,borderRadius:12,padding:"12px 16px",color:TEXT,fontFamily:FB,fontSize:13,outline:"none",resize:"none",lineHeight:1.6}}/>
            </div>

            {/* Adaptive summary */}
            {(effort >= 4 || painAreas.length > 0 || completion === "scaled") && (
              <div style={{padding:"13px 16px",borderRadius:13,background:"rgba(240,192,96,0.08)",border:"1px solid rgba(240,192,96,0.2)",marginBottom:20}}>
                <div style={{fontSize:11,color:"#F0C060",fontWeight:700,letterSpacing:"0.08em",marginBottom:6}}>⚙ ENGINE WILL ADJUST</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {effort >= 5 && <div style={{fontSize:12,color:MUTED}}>• High effort — next session volume may be reduced slightly</div>}
                  {effort >= 4 && <div style={{fontSize:12,color:MUTED}}>• Rest periods will be extended next session</div>}
                  {painAreas.length > 0 && <div style={{fontSize:12,color:MUTED}}>• New pain areas flagged — those movements will be excluded</div>}
                  {completion === "scaled" && <div style={{fontSize:12,color:MUTED}}>• Protocol Tier will be reviewed downward</div>}
                  {completion === "all" && effort <= 2 && <div style={{fontSize:12,color:MUTED}}>• Felt easy — next session load or volume may increase</div>}
                </div>
              </div>
            )}

            <button onClick={submitFull} style={{
              width:"100%",padding:"17px",borderRadius:14,border:"none",
              background:COLOR,color:BG,
              fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
              cursor:"pointer",boxShadow:`0 6px 24px ${COLOR}30`
            }}>
              SAVE SESSION ✓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SESSION HISTORY / PROGRESS VIEW ─────────────────────────────────────────
export function SessionHistory({ user, onReaudit, trackColor }) {
  const COLOR = trackColor || "#F0C060";
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState("history"); // history | progress

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("ff_sessions") || "[]");
      setSessions(s);
    } catch { setSessions([]); }
  }, []);

  const sessionCount = sessions.length;
  const reauditDue = sessionCount > 0 && sessionCount % 8 === 0;
  const streak = Math.min(sessionCount, 7); // simplified streak

  const EFFORT_LABELS = ["","Very Easy","Easy","Moderate","Hard","Max Effort"];
  const effortColors = ["","#34D399","#5EEAD4","#F0C060","#FB923C","#F87171"];

  return (
    <div style={{padding:"24px 22px 0",fontFamily:FB,color:TEXT}}>
      <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>TRAINING LOG</div>
      <h2 style={{fontFamily:FD,fontSize:34,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:20}}>Your<br/><span style={{color:COLOR}}>progress.</span></h2>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
        {[
          {label:"Sessions",value:sessionCount,icon:"🏋️"},
          {label:"Streak",value:`${streak}d`,icon:"🔥"},
          {label:"Next audit",value:`${8-(sessionCount%8)} left`,icon:"📊"},
        ].map(s=>(
          <div key={s.label} style={{padding:"14px 10px",borderRadius:12,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:COLOR,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:3,letterSpacing:"0.06em",textTransform:"uppercase"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Re-audit CTA */}
      {reauditDue && (
        <div onClick={onReaudit} style={{
          padding:"16px 18px",borderRadius:14,marginBottom:20,cursor:"pointer",
          background:"rgba(240,192,96,0.08)",border:"1.5px solid rgba(240,192,96,0.35)",
          display:"flex",justifyContent:"space-between",alignItems:"center"
        }}>
          <div>
            <div style={{fontSize:11,color:"#F0C060",fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>FX RE-AUDIT DUE</div>
            <div style={{fontSize:13,color:MUTED}}>8 sessions completed — time to recalibrate your FX scores.</div>
          </div>
          <span style={{color:"#F0C060",fontSize:20}}>→</span>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <div style={{padding:"48px 20px",textAlign:"center",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:MUTED}}>NO SESSIONS YET</div>
          <div style={{fontSize:13,color:MUTED,marginTop:8}}>Complete a session and check in to start your log.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sessions.slice(0,20).map((s,i)=>{
            const d = new Date(s.timestamp);
            const dateStr = d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
            const effortColor = effortColors[s.effort] || MUTED;
            return (
              <div key={i} style={{padding:"14px 16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:TEXT,letterSpacing:"0.02em"}}>{s.format || "Strength"} Protocol</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>{dateStr}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {s.effort && <span style={{fontSize:11,padding:"3px 9px",borderRadius:7,background:`${effortColor}15`,color:effortColor,fontWeight:700}}>{EFFORT_LABELS[s.effort]}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:FAINT,color:MUTED}}>
                    {s.completion === "all" ? "✅ Complete" : s.completion === "scaled" ? "🔵 Scaled" : s.completion === "mostly" ? "🟡 Mostly" : "🟠 Partial"}
                  </span>
                  {s.painAreas?.length > 0 && (
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"rgba(248,113,113,0.1)",color:"#F87171"}}>
                      🔴 {s.painAreas.join(", ")}
                    </span>
                  )}
                  {s.flags?.reduceLoad && <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:"rgba(240,192,96,0.1)",color:"#F0C060"}}>⚙ Load adjusted</span>}
                </div>
                {s.notes && <div style={{marginTop:8,fontSize:12,color:MUTED,fontStyle:"italic",lineHeight:1.5}}>"{s.notes}"</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MET VALUES PER FORMAT ────────────────────────────────────────────────────
const FORMAT_MET = {
  STRENGTH: 5.0,
  CIRCUIT:  7.5,
  AMRAP:    8.5,
  EMOM:     7.0,
  TABATA:   8.0,
};

const EFFORT_MET_MULT = { 1:0.75, 2:0.88, 3:1.0, 4:1.12, 5:1.25 };

// Estimate calorie range from format, duration (minutes), weight (kg), effort (1-5)
export function estimateCalories(formatId, durationMinutes, weightKg=75, effort=3) {
  const met = FORMAT_MET[formatId] || 5.5;
  const mult = EFFORT_MET_MULT[effort] || 1.0;
  const base = met * mult * weightKg * (durationMinutes / 60);
  const lo = Math.round(base * 0.88);
  const hi = Math.round(base * 1.12);
  return { lo, hi, mid: Math.round((lo+hi)/2) };
}

// HR zone from effort rating
const HR_ZONES = {
  1: { zone:1, label:"Recovery",    color:"#60A5FA", pct:"50–60%", desc:"Light movement, warm-up intensity" },
  2: { zone:2, label:"Fat Burn",    color:"#34D399", pct:"60–70%", desc:"Comfortable, can hold a conversation" },
  3: { zone:3, label:"Aerobic",     color:"#F0C060", pct:"70–80%", desc:"Moderate, breathing elevated" },
  4: { zone:4, label:"Threshold",   color:"#FB923C", pct:"80–90%", desc:"Hard, short sentences only" },
  5: { zone:5, label:"Max Effort",  color:"#F87171", pct:"90–100%",desc:"All out, unsustainable" },
};

// Estimate peak HR from age and effort
function estimatePeakHR(age, effort) {
  const maxHR = 220 - (age || 30);
  const zonePcts = { 1:0.55, 2:0.65, 3:0.75, 4:0.85, 5:0.95 };
  return Math.round(maxHR * (zonePcts[effort] || 0.75));
}

// Smart headline templates (instant, before AI loads)
function buildHeadline(user, sessionData) {
  const { format, effort, completion, durationMinutes, sessions } = sessionData;
  const firstName = user.name?.split(" ")[0] || "Athlete";
  const trackName = user.track || "FORGE";

  const templates = {
    5: [ // max effort
      `That was everything you had, ${firstName}. Respect.`,
      `Max effort ${trackName} session. The engine is running hot.`,
      `${firstName} left nothing on the floor today.`,
    ],
    4: [
      `Solid ${trackName} work, ${firstName}. Engine output is climbing.`,
      `Protocol complete. FX scores are being earned today.`,
      `${firstName} — that's the kind of session that builds something.`,
    ],
    3: [
      `${trackName} protocol checked off, ${firstName}. Consistency is the compound.`,
      `Good work. The session is logged, the adaptation begins.`,
      `Steady work from ${firstName} today. The machine keeps moving.`,
    ],
    2: [
      `Recovery session banked, ${firstName}. These are underrated.`,
      `Light day done. The body is listening.`,
    ],
    1: [
      `Movement counts, ${firstName}. Even easy days build the base.`,
      `Active recovery logged. Smart training.`,
    ],
  };

  const pool = templates[effort] || templates[3];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Workout score (0–100) based on effort, completion, format
function calcWorkoutScore(effort, completion, format, durationMinutes) {
  let base = effort * 16; // max 80
  if (completion === "all") base += 15;
  else if (completion === "mostly") base += 10;
  else if (completion === "partial") base += 5;
  if (durationMinutes >= 30) base += 5;
  return Math.min(100, Math.round(base));
}

// ─── SESSION RECAP SCREEN ─────────────────────────────────────────────────────
export function SessionRecap({ sessionData, user, onQuickCheckin, onFullDebrief }) {
  const {
    format = "STRENGTH",
    durationMinutes = 45,
    exerciseCount = 6,
    rounds = 1,
    effort = 3,
    trackColor = "#F0C060",
    trackName = "FORGE",
  } = sessionData;

  const COLOR = trackColor;
  const weight = user.weightKg || 75;
  const age = user.age || 30;

  // Computed stats
  const cals = estimateCalories(format, durationMinutes, weight, effort);
  const hrZone = HR_ZONES[effort] || HR_ZONES[3];
  const estimatedPeakHR = estimatePeakHR(age, effort);
  const score = calcWorkoutScore(effort, null, format, durationMinutes);
  const sessions = (() => { try { return JSON.parse(localStorage.getItem("ff_sessions")||"[]").length; } catch { return 0; } })();

  // Animated reveal state
  const [revealed, setRevealed] = useState(0); // 0..5
  const [headline, setHeadline] = useState(buildHeadline(user, { ...sessionData, sessions }));
  const [aiHeadline, setAiHeadline] = useState(null);
  const [peakHR, setPeakHR] = useState(estimatedPeakHR);
  const [hrOverride, setHrOverride] = useState(false);
  const [showHRSlider, setShowHRSlider] = useState(false);

  // Staggered stat reveal
  useEffect(() => {
    const timers = [0,350,650,950,1200,1500].map((d,i) =>
      setTimeout(() => setRevealed(i+1), d)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Async AI headline — fires after reveal
  useEffect(() => {
    if (revealed < 4) return;
    const fetchHeadline = async () => {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 80,
            messages: [{
              role: "user",
              content: `You are FitForge's session summary AI. Write ONE punchy, motivating session headline for this athlete. Max 12 words. No quotes. No emojis. Sound like a great coach, not a chatbot.

Athlete: ${user.name} | Age: ${user.age || "unknown"} | Track: ${trackName}
Format: ${format} | Duration: ${durationMinutes} min | Effort: ${effort}/5
Calories: ${cals.lo}–${cals.hi} | Exercises: ${exerciseCount} | Score: ${score}/100
Sessions completed total: ${sessions + 1}

Write only the headline, nothing else.`
            }]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text?.trim();
        if (text && text.length > 5 && text.length < 100) setAiHeadline(text);
      } catch {}
    };
    fetchHeadline();
  }, [revealed]);

  // HR zone derived from actual peak HR
  function hrToZone(hr) {
    const maxHR = 220 - (age || 30);
    const pct = hr / maxHR;
    if (pct < 0.6) return HR_ZONES[1];
    if (pct < 0.7) return HR_ZONES[2];
    if (pct < 0.8) return HR_ZONES[3];
    if (pct < 0.9) return HR_ZONES[4];
    return HR_ZONES[5];
  }
  const activeHRZone = hrOverride ? hrToZone(peakHR) : hrZone;

  const statVisible = (n) => ({ opacity: revealed >= n ? 1 : 0, transform: revealed >= n ? "translateY(0)" : "translateY(12px)", transition: "all 0.45s cubic-bezier(0.22,1,0.36,1)" });

  const fmtTime = (m) => m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;

  // Milestone callouts
  const milestone = sessions + 1 === 1 ? "🎉 First session logged!" :
                    (sessions + 1) % 10 === 0 ? `🔥 ${sessions+1} sessions completed!` :
                    (sessions + 1) % 8 === 0 ? "📊 FX re-audit available!" : null;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200, background:BG,
      fontFamily:FB, color:TEXT, overflowY:"auto",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scoreCount{from{opacity:0;transform:scale(0.6)}to{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        *{box-sizing:border-box}
      `}</style>

      <div style={{maxWidth:500, margin:"0 auto", width:"100%", padding:"32px 22px 40px"}}>

        {/* Header */}
        <div style={{...statVisible(1), marginBottom:28}}>
          <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:10}}>SESSION COMPLETE</div>

          {/* Headline — template first, AI swap */}
          <h2 style={{fontFamily:FD,fontSize:34,fontWeight:800,letterSpacing:"0.02em",lineHeight:1.05,color:TEXT,minHeight:80,transition:"all 0.5s ease"}}>
            {aiHeadline || headline}
          </h2>
          {!aiHeadline && revealed >= 4 && (
            <div style={{fontSize:11,color:MUTED,marginTop:4,
              background:"linear-gradient(90deg,transparent,rgba(240,192,96,0.3),transparent)",
              backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite",
              borderRadius:4,padding:"2px 8px",display:"inline-block"
            }}>generating your recap…</div>
          )}
        </div>

        {/* Milestone banner */}
        {milestone && (
          <div style={{...statVisible(1), padding:"12px 16px",borderRadius:12,background:`${COLOR}10`,border:`1px solid ${COLOR}30`,marginBottom:20,fontSize:13,color:COLOR,fontWeight:700,textAlign:"center"}}>
            {milestone}
          </div>
        )}

        {/* Big stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>

          {/* Score — largest */}
          <div style={{...statVisible(2), gridColumn:"1/-1", padding:"24px", borderRadius:18,
            background:`${COLOR}10`, border:`2px solid ${COLOR}30`, textAlign:"center",
            position:"relative", overflow:"hidden"
          }}>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 120%,${COLOR}20,transparent 60%)`,pointerEvents:"none"}}/>
            <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>WORKOUT SCORE</div>
            <div style={{fontFamily:FD,fontSize:88,fontWeight:800,color:COLOR,lineHeight:0.9,letterSpacing:"-0.02em",
              animation:revealed>=2?"scoreCount 0.5s cubic-bezier(0.22,1,0.36,1)":"none"
            }}>{score}</div>
            <div style={{fontSize:14,color:MUTED,marginTop:6}}>/100</div>
          </div>

          {/* Duration */}
          <div style={{...statVisible(2), padding:"20px 16px", borderRadius:16, background:SURFACE, border:`1px solid ${BORDER2}`, textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>⏱</div>
            <div style={{fontFamily:FD,fontSize:34,fontWeight:800,color:TEXT,lineHeight:1}}>{fmtTime(durationMinutes)}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Duration</div>
          </div>

          {/* Calories */}
          <div style={{...statVisible(3), padding:"20px 16px", borderRadius:16, background:SURFACE, border:`1px solid ${BORDER2}`, textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>🔥</div>
            <div style={{fontFamily:FD,fontSize:30,fontWeight:800,color:"#FB923C",lineHeight:1}}>{cals.lo}–{cals.hi}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Est. kcal</div>
          </div>

          {/* Exercises */}
          <div style={{...statVisible(3), padding:"20px 16px", borderRadius:16, background:SURFACE, border:`1px solid ${BORDER2}`, textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:8}}>💪</div>
            <div style={{fontFamily:FD,fontSize:34,fontWeight:800,color:TEXT,lineHeight:1}}>{exerciseCount}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Exercises</div>
          </div>

          {/* Rounds — only if >1 */}
          {rounds > 1 && (
            <div style={{...statVisible(3), padding:"20px 16px", borderRadius:16, background:SURFACE, border:`1px solid ${BORDER2}`, textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>🔁</div>
              <div style={{fontFamily:FD,fontSize:34,fontWeight:800,color:TEXT,lineHeight:1}}>{rounds}</div>
              <div style={{fontSize:10,color:MUTED,marginTop:4,letterSpacing:"0.08em",textTransform:"uppercase"}}>Rounds</div>
            </div>
          )}
        </div>

        {/* Heart Rate Zone */}
        <div style={{...statVisible(4), marginBottom:16}}>
          <div style={{padding:"18px 20px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>HEART RATE ZONE</div>
                <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:activeHRZone.color,letterSpacing:"0.04em"}}>
                  Zone {activeHRZone.zone} — {activeHRZone.label}
                </div>
                <div style={{fontSize:12,color:MUTED,marginTop:2}}>{activeHRZone.desc}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:FD,fontSize:32,fontWeight:800,color:activeHRZone.color,lineHeight:1}}>{peakHR}</div>
                <div style={{fontSize:10,color:MUTED}}>peak bpm</div>
              </div>
            </div>

            {/* Zone bar */}
            <div style={{display:"flex",gap:3,marginBottom:12}}>
              {[1,2,3,4,5].map(z=>(
                <div key={z} style={{
                  flex:1,height:8,borderRadius:4,
                  background:z<=activeHRZone.zone?HR_ZONES[z].color:FAINT,
                  transition:"background 0.4s"
                }}/>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:10,color:MUTED}}>50%</span>
              <span style={{fontSize:10,color:activeHRZone.color,fontWeight:700}}>{activeHRZone.pct} max HR</span>
              <span style={{fontSize:10,color:MUTED}}>100%</span>
            </div>

            {/* HR override toggle */}
            <button onClick={()=>setShowHRSlider(s=>!s)} style={{
              width:"100%",padding:"10px",borderRadius:10,
              background:showHRSlider?`${activeHRZone.color}12`:FAINT,
              border:`1px solid ${showHRSlider?activeHRZone.color:BORDER2}`,
              color:showHRSlider?activeHRZone.color:MUTED,
              cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:600,transition:"all 0.2s"
            }}>
              {showHRSlider?"▲ Hide" : "Enter your actual peak HR"} 
            </button>

            {showHRSlider && (
              <div style={{marginTop:14,animation:"fadeIn 0.2s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:12,color:MUTED}}>Peak HR</span>
                  <span style={{fontFamily:FD,fontSize:20,fontWeight:800,color:activeHRZone.color}}>{peakHR} bpm</span>
                </div>
                <input type="range" min={80} max={220} value={peakHR}
                  onChange={e=>{ setPeakHR(Number(e.target.value)); setHrOverride(true); }}
                  style={{width:"100%",accentColor:activeHRZone.color,cursor:"pointer"}}
                />
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:MUTED,marginTop:4}}>
                  <span>80</span><span>150</span><span>220</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Weight note if not set */}
        {!user.weightKg && (
          <div style={{...statVisible(4), padding:"11px 14px",borderRadius:11,background:FAINT,border:`1px solid ${BORDER2}`,marginBottom:16,fontSize:11,color:MUTED}}>
            💡 Add your weight in Profile settings to get more accurate calorie estimates.
          </div>
        )}

        {/* Check-in choice */}
        <div style={{...statVisible(5), marginTop:8}}>
          <div style={{fontSize:12,color:MUTED,textAlign:"center",marginBottom:14,fontWeight:600}}>
            How would you like to check in?
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={()=>onQuickCheckin({ ...sessionData, score, calories:cals, peakHR, hrZone:activeHRZone.zone })} style={{
              padding:"22px 12px",borderRadius:16,border:`1.5px solid ${BORDER2}`,
              background:SURFACE,color:TEXT,cursor:"pointer",fontFamily:FB,
              textAlign:"center",transition:"all 0.2s"
            }}>
              <div style={{fontSize:28,marginBottom:8}}>⚡</div>
              <div style={{fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.04em",marginBottom:4}}>QUICK</div>
              <div style={{fontSize:11,color:MUTED,lineHeight:1.4}}>30 seconds<br/>3 taps</div>
            </button>

            <button onClick={()=>onFullDebrief({ ...sessionData, score, calories:cals, peakHR, hrZone:activeHRZone.zone })} style={{
              padding:"22px 12px",borderRadius:16,border:`1.5px solid ${COLOR}`,
              background:`${COLOR}10`,color:TEXT,cursor:"pointer",fontFamily:FB,
              textAlign:"center",transition:"all 0.2s",
              boxShadow:`0 6px 24px ${COLOR}20`
            }}>
              <div style={{fontSize:28,marginBottom:8}}>📋</div>
              <div style={{fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.04em",color:COLOR,marginBottom:4}}>FULL DEBRIEF</div>
              <div style={{fontSize:11,color:MUTED,lineHeight:1.4}}>2 minutes<br/>Body map + AI</div>
            </button>
          </div>

          <button onClick={()=>onQuickCheckin(null)} style={{
            width:"100%",marginTop:12,padding:"13px",borderRadius:12,
            background:"transparent",border:"none",
            color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:12
          }}>
            Skip check-in for now
          </button>
        </div>

      </div>
    </div>
  );
}
