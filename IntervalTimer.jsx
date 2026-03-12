import { useState, useEffect, useRef, useCallback } from "react";

// ─── PROTOCOL → TIMER DERIVATION ENGINE ──────────────────────────────────────
// Reads actual workout slots and track to produce the right timer config
export function deriveTimerConfig(slots = [], trackId = "FORGE") {
  if (!slots.length) return getDefaultConfig(trackId);

  // Parse sets from string like "3–5", "4", "3–4"
  const parseSets = s => {
    if (!s) return 3;
    const n = String(s).match(/\d+/g);
    return n ? Math.round(n.reduce((a,b)=>+a + +b,0)/n.length) : 3;
  };

  // Parse rep range to estimate work duration
  // "8–12" → ~45s,  "3–5" (heavy) → ~30s,  "15–20" → ~55s,  "30–60s" → 45s
  const estimateWorkSecs = (repsStr, slot) => {
    if (!repsStr) return 40;
    const s = String(repsStr);
    // Already a time
    if (s.includes("s") || s.includes("min")) {
      const match = s.match(/(\d+)/g);
      if (match) {
        const vals = match.map(Number);
        return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
      }
    }
    const nums = s.match(/\d+/g);
    if (!nums) return 40;
    const avg = nums.reduce((a,b)=>+a + +b,0)/nums.length;
    // Metcon slots get interval timing
    if (slot === "METCON") return Math.min(60, Math.max(30, Math.round(avg * 2.5)));
    // High reps = longer set
    if (avg >= 20) return 55;
    if (avg >= 12) return 45;
    if (avg >= 8)  return 35;
    return 25; // heavy strength, low reps
  };

  // Estimate rest from slot type + rep range
  const estimateRestSecs = (repsStr, slotType, trackId) => {
    if (trackId === "SURGE") return 15; // FORGE45 style — short rest
    if (trackId === "FLOW")  return 10; // mobility — minimal rest
    // FORGE — strength-based rest
    const nums = (repsStr||"").match(/\d+/g);
    const avg = nums ? nums.reduce((a,b)=>+a+ +b,0)/nums.length : 8;
    if (slotType === "METCON") return 20;
    if (avg <= 5)  return 120; // heavy compound
    if (avg <= 8)  return 90;
    if (avg <= 12) return 60;
    return 45; // higher rep accessory
  };

  // Build per-slot timing blocks
  const blocks = slots.map(slot => ({
    exerciseName: slot.exercise || slot.exerciseName || slot.name || "",
    slotType: slot.slotType || "",
    sets: parseSets(slot.sets),
    reps: slot.reps || "",
    workSecs: estimateWorkSecs(slot.reps, slot.slotType),
    restSecs: estimateRestSecs(slot.reps, slot.slotType, trackId),
  }));

  // ── Track-level config ──
  if (trackId === "SURGE") {
    return {
      mode: "STRENGTH",
      formatLabel: "SURGE",
      formatDesc: "Strength sets · explosive pace · short rest",
      color: "#F0C060",
      workSecs: null,
      restSecs: null,
      blocks,
      cycles: 1,
      prepSecs: 10,
      warmup: deriveWarmup(trackId),
      cooldown: deriveCooldown(trackId),
    };
  }

  if (trackId === "FLOW") {
    // FLOW uses per-exercise sets — do all sets of one exercise before moving on
    // Short rest between sets (mobility focus), medium rest between exercises
    return {
      mode: "STRENGTH",
      formatLabel: "FLOW",
      formatDesc: "Timed holds · all sets per exercise · short rest",
      color: "#5EEAD4",
      workSecs: null, // varies per slot (timed from reps string)
      restSecs: null,
      blocks,
      cycles: 1,
      prepSecs: 10,
      warmup: deriveWarmup(trackId),
      cooldown: deriveCooldown(trackId),
    };
  }

  // FORGE — strength, per-slot variable timing
  return {
    mode: "STRENGTH",
    formatLabel: "FORGE",
    formatDesc: "Strength sets · variable rest",
    color: "#F87171",
    workSecs: null, // varies per slot
    restSecs: null, // varies per slot
    blocks,
    cycles: 1,
    prepSecs: 10,
    warmup: deriveWarmup(trackId),
    cooldown: deriveCooldown(trackId),
  };
}

function getDefaultConfig(trackId) {
  const defaults = {
    FORGE:  { mode:"STRENGTH", formatLabel:"FORGE",   formatDesc:"Strength sets · variable rest",         color:"#F87171", workSecs:35, restSecs:90, cycles:1 },
    SURGE:  { mode:"INTERVAL", formatLabel:"FORGE45", formatDesc:"45s work · 15s rest · cycle stations",  color:"#F0C060", workSecs:45, restSecs:15, cycles:3 },
    FLOW:   { mode:"FLOW",     formatLabel:"FLOW",     formatDesc:"50s work · 10s transition",             color:"#5EEAD4", workSecs:50, restSecs:10, cycles:1 },
  };
  return { ...defaults[trackId]||defaults.FORGE, blocks:[], prepSecs:10, warmup:deriveWarmup(trackId), cooldown:deriveCooldown(trackId) };
}

function deriveWarmup(trackId) {
  const warmups = {
    FORGE: [{name:"Arm Circles",secs:30},{name:"Hip Hinge Drill",secs:30},{name:"Bodyweight Squat",secs:30},{name:"Cat-Cow",secs:30}],
    SURGE: [{name:"Jumping Jacks",secs:30},{name:"High Knees",secs:30},{name:"Arm Swings",secs:30},{name:"Hip Circles",secs:30}],
    FLOW:  [{name:"Neck Rolls",secs:30},{name:"Shoulder Rolls",secs:30},{name:"Hip Circles",secs:30},{name:"Ankle Circles",secs:30}],
  };
  return warmups[trackId]||warmups.FORGE;
}

function deriveCooldown(trackId) {
  return [
    {name:"Standing Quad Stretch",secs:30},
    {name:"Hamstring Stretch",secs:30},
    {name:"Child's Pose",secs:45},
    {name:"Deep Breathing",secs:30},
  ];
}

// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
function useBeeper() {
  const ctx = useRef(null);
  const beep = useCallback((freq=880, dur=0.1, vol=0.4) => {
    try {
      if (!ctx.current) ctx.current = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.current.createOscillator();
      const g = ctx.current.createGain();
      o.connect(g); g.connect(ctx.current.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.current.currentTime + dur);
      o.start(); o.stop(ctx.current.currentTime + dur);
    } catch(e) {}
  }, []);
  const tick      = useCallback(() => beep(440, 0.06, 0.25), [beep]);
  const countdown = useCallback(() => beep(550, 0.1,  0.35), [beep]);
  const phaseEnd  = useCallback(() => { beep(880,0.15,0.5); setTimeout(()=>beep(1320,0.2,0.5),180); }, [beep]);
  const workStart = useCallback(() => { beep(660,0.1,0.4); setTimeout(()=>beep(880,0.12,0.5),140); setTimeout(()=>beep(1100,0.18,0.6),280); }, [beep]);
  const finish    = useCallback(() => { [0,180,360,540,720].forEach(d=>setTimeout(()=>beep(880+d*1.5,0.15,0.4),d)); }, [beep]);
  return { tick, countdown, phaseEnd, workStart, finish };
}

// ─── BUILD FLAT SEQUENCE FROM CONFIG ─────────────────────────────────────────
// Returns array of {phase, label, secs, slotIdx, setNum, totalSets, exercise, reps}
function buildSequence(config) {
  const seq = [];
  const { mode, blocks, cycles, prepSecs, warmup, cooldown, workSecs, restSecs } = config;

  // Warmup
  warmup.forEach(w => {
    seq.push({ phase:"WARMUP", label:w.name, secs:w.secs, exercise:w.name, reps:"" });
    seq.push({ phase:"TRANSITION", label:"Next up", secs:5, exercise:"", reps:"" });
  });

  // Prepare
  seq.push({ phase:"PREPARE", label:"GET READY", secs:prepSecs, exercise:"", reps:"" });

  if (mode === "INTERVAL" || mode === "FLOW") {
    // Cycle through all slots N times
    for (let c = 0; c < cycles; c++) {
      blocks.forEach((block, bi) => {
        const work = workSecs || block.workSecs;
        const rest = restSecs || block.restSecs;
        seq.push({
          phase:"WORK", label:"WORK",
          secs: work,
          slotIdx: bi,
          cycleNum: c+1, totalCycles: cycles,
          exercise: block.exerciseName, reps: block.reps,
          stationNum: bi+1, totalStations: blocks.length,
        });
        // Rest between stations (skip after last station of last cycle)
        const isLast = c === cycles-1 && bi === blocks.length-1;
        if (!isLast && rest > 0) {
          const nextBlock = blocks[(bi+1) % blocks.length];
          seq.push({
            phase:"REST", label:"REST",
            secs: rest,
            nextExercise: nextBlock?.exerciseName || "",
            cycleNum: c+1, totalCycles: cycles,
          });
        }
      });
    }
  } else {
    // STRENGTH mode — per slot, per set
    blocks.forEach((block, bi) => {
      const sets = block.sets;
      for (let s = 0; s < sets; s++) {
        seq.push({
          phase:"WORK", label:`SET ${s+1} / ${sets}`,
          secs: block.workSecs,
          slotIdx: bi,
          setNum: s+1, totalSets: sets,
          exercise: block.exerciseName, reps: block.reps,
        });
        const isLastSet = s === sets-1;
        const isLastSlot = bi === blocks.length-1;
        if (!(isLastSet && isLastSlot)) {
          const restSec = isLastSet ? Math.min(block.restSecs, 30) : block.restSecs;
          const nextEx = isLastSet ? (blocks[bi+1]?.exerciseName || "") : block.exerciseName;
          const restLabel = isLastSet
            ? `NEXT: ${(blocks[bi+1]?.exerciseName || "").toUpperCase()}`
            : `REST · SET ${s+2} / ${sets} NEXT`;
          seq.push({
            phase:"REST", label: restLabel,
            secs: restSec,
            nextExercise: nextEx,
            setNum: s+1, totalSets: sets,
            slotIdx: bi,
          });
        }
      }
    });
  }

  // Cooldown
  seq.push({ phase:"PREPARE", label:"COOL DOWN", secs:5, exercise:"", reps:"" });
  cooldown.forEach(w => {
    seq.push({ phase:"COOLDOWN", label:w.name, secs:w.secs, exercise:w.name, reps:"" });
    seq.push({ phase:"TRANSITION", label:"", secs:5, exercise:"", reps:"" });
  });

  seq.push({ phase:"DONE", label:"SESSION COMPLETE", secs:0, exercise:"", reps:"" });
  return seq;
}

// ─── PHASE COLORS ─────────────────────────────────────────────────────────────
const PHASE_STYLE = {
  PREPARE:    { bg:"#FFE500", text:"#000" },
  WORK:       { bg:"#16A34A", text:"#fff" },
  REST:       { bg:"#1D4ED8", text:"#fff" },
  WARMUP:     { bg:"#7C3AED", text:"#fff" },
  COOLDOWN:   { bg:"#0E7490", text:"#fff" },
  TRANSITION: { bg:"#374151", text:"#fff" },
  DONE:       { bg:"#06080C", text:"#F0C060" },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function IntervalTimer({ slots=[], trackId="FORGE", trackColor="#F0C060", trackName="SESSION", onClose, onComplete }) {
  const config   = useRef(deriveTimerConfig(slots, trackId));
  const sequence = useRef(buildSequence(config.current));

  const [seqIdx,    setSeqIdx]    = useState(0);
  const [secs,      setSecs]      = useState(null);
  const [running,   setRunning]   = useState(false);
  const [started,   setStarted]   = useState(false);
  const [totalSecs, setTotalSecs] = useState(0);
  const [showSetup, setShowSetup] = useState(true);

  const tickRef    = useRef(null);
  const secsRef    = useRef(0);
  const seqIdxRef  = useRef(0);
  const runRef     = useRef(false);
  const { tick, countdown, phaseEnd, workStart, finish } = useBeeper();

  const cfg = config.current;
  const seq = sequence.current;
  const cur = seq[seqIdx] || seq[seq.length-1];

  // Keep refs in sync
  useEffect(() => { seqIdxRef.current = seqIdx; }, [seqIdx]);
  useEffect(() => { runRef.current = running; },   [running]);

  // Core tick loop — called whenever we need to (re)start counting
  const startTick = () => {
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (!runRef.current) return;
      secsRef.current -= 1;
      const s = secsRef.current;
      if (s <= 3 && s > 0) countdown();
      if (s <= 0) {
        advanceRef.current(seqIdxRef.current);
        return;
      }
      setSecs(s);
      setTotalSecs(t => t + 1);
    }, 1000);
  };

  // Advance stored in ref so startTick closure can call it without stale capture
  const advanceRef = useRef(null);
  advanceRef.current = (idx) => {
    clearInterval(tickRef.current);
    const next = idx + 1;
    if (next >= seq.length) return;
    const nextStep = seq[next];
    seqIdxRef.current = next;
    secsRef.current = nextStep.secs || 0;
    setSeqIdx(next);
    setSecs(nextStep.secs || 0);
    if (nextStep.phase === "DONE") { finish(); setRunning(false); runRef.current = false; return; }
    // Auto-skip zero-duration steps
    if ((nextStep.secs || 0) === 0) { advanceRef.current(next); return; }
    // Sound cues
    if (nextStep.phase === "WORK")   workStart();
    else if (nextStep.phase === "REST" || nextStep.phase === "PREPARE" || nextStep.phase === "TRANSITION") phaseEnd();
    // Always keep running after advance (skip or natural end of phase)
    if (runRef.current) startTick();
  };

  // Only pause/resume changes the tick — advance handles its own restart
  useEffect(() => {
    if (running && cur.phase !== "DONE") {
      startTick();
    } else {
      clearInterval(tickRef.current);
    }
    return () => clearInterval(tickRef.current);
  }, [running]);

  // Auto-complete 3s after DONE phase is reached
  useEffect(() => {
    if (cur.phase === "DONE") {
      const t = setTimeout(() => {
        if (onComplete) onComplete();
        else onClose?.();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [cur.phase]);

  // Voice command listener
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !started) return;
    let active = true;
    const loop = () => {
      if (!active) return;
      const r = new SR();
      r.continuous = false; r.interimResults = false; r.lang = "en-US";
      r.onresult = (e) => {
        const t = e.results[0][0].transcript.toLowerCase().trim();
        if (t.includes("pause") || t.includes("stop"))            { pause(); }
        else if (t.includes("resume") || t.includes("continue"))  { resume(); }
        else if (t.includes("skip rest"))                          { skipRest(); }
        else if (t.includes("skip") || t.includes("next"))        { skip(); }
        else if (t.includes("end") || t.includes("finish"))       { onComplete ? onComplete() : onClose?.(); }
      };
      r.onend = () => { if (active && runRef.current) setTimeout(loop, 300); };
      r.onerror = () => { if (active) setTimeout(loop, 1000); };
      r.start();
    };
    loop();
    return () => { active = false; };
  }, [started]);

  const start = () => {
    const initSecs = seq[0]?.secs || 3;
    secsRef.current = initSecs;
    seqIdxRef.current = 0;
    runRef.current = true;
    setSecs(initSecs);
    setSeqIdx(0);
    setRunning(true);
    setStarted(true);
    setShowSetup(false);
    setTimeout(() => startTick(), 50); // small delay so state settles
  };
  const pause  = () => { runRef.current = false; setRunning(false); clearInterval(tickRef.current); };
  const resume = () => { runRef.current = true; setRunning(true); };
  const reset  = () => {
    clearInterval(tickRef.current);
    runRef.current = false;
    seqIdxRef.current = 0;
    secsRef.current = seq[0]?.secs || 10;
    setSeqIdx(0);
    setSecs(seq[0]?.secs || 10);
    setRunning(false);
    setStarted(false);
    setShowSetup(true);
    setTotalSecs(0);
  };
  // Skip: insert a 3s PREPARE buffer then advance, keep running
  const skip = () => {
    clearInterval(tickRef.current);
    const prepSecs = 3;
    secsRef.current = prepSecs;
    setSecs(prepSecs);
    // Temporarily show PREPARE, then advance for real after 3s
    const targetIdx = seqIdxRef.current + 1;
    let s = prepSecs;
    tickRef.current = setInterval(() => {
      s -= 1;
      if (s <= 0) {
        clearInterval(tickRef.current);
        advanceRef.current(seqIdxRef.current);
        return;
      }
      countdown();
      setSecs(s);
    }, 1000);
  };
  // Skip rest immediately — jump straight to next WORK phase
  const skipRest = () => {
    // Find next WORK step
    let idx = seqIdxRef.current + 1;
    while (idx < seq.length && seq[idx].phase !== "WORK" && seq[idx].phase !== "DONE") idx++;
    if (idx >= seq.length) return;
    clearInterval(tickRef.current);
    const nextStep = seq[idx];
    seqIdxRef.current = idx;
    secsRef.current = nextStep.secs || 0;
    setSeqIdx(idx);
    setSecs(nextStep.secs || 0);
    workStart();
    if (runRef.current) startTick();
  };

  const fmtSecs = s => `${String(Math.floor((s||0)/60)).padStart(2,"0")}:${String((s||0)%60).padStart(2,"0")}`;

  // Progress through total session
  const totalSessionSecs = seq.reduce((a,s)=>a+(s.secs||0),0);
  const progressPct = Math.min(100,(totalSecs/Math.max(1,totalSessionSecs))*100);
  const phaseProgressPct = cur.secs > 0 ? ((cur.secs-(secs||0))/cur.secs)*100 : 100;

  // Count stats
  const workBlocks  = seq.filter(s=>s.phase==="WORK");
  const curWorkIdx  = workBlocks.findIndex((_,i)=>seq.indexOf(workBlocks[i])===seqIdx);
  const workDone    = workBlocks.filter((_,i)=>seq.indexOf(workBlocks[i])<seqIdx).length;

  const ps = PHASE_STYLE[cur.phase] || PHASE_STYLE.WORK;

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (showSetup) {
    const totalMin = Math.round(totalSessionSecs / 60);
    const warmupMin = Math.round(cfg.warmup.reduce((a,w)=>a+w.secs,0)/60);

    return (
      <div style={{position:"fixed",inset:0,zIndex:300,background:"#06080C",fontFamily:"'Barlow Condensed',sans-serif",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;600;700&display=swap');`}</style>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div>
            <div style={{fontSize:11,color:"rgba(238,242,248,0.4)",fontWeight:700,letterSpacing:"0.12em"}}>INTERVAL TIMER</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:"#EEF2F8",letterSpacing:"0.04em"}}>{trackName}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:36,height:36,color:"rgba(238,242,248,0.5)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{padding:"20px",flex:1}}>

          {/* Auto-detected format badge */}
          <div style={{padding:"16px",borderRadius:16,background:`${cfg.color}10`,border:`2px solid ${cfg.color}30`,marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:cfg.color,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>AUTO-DETECTED FORMAT</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,color:cfg.color,letterSpacing:"0.08em"}}>{cfg.formatLabel}</div>
              <div style={{fontSize:12,color:"rgba(238,242,248,0.45)",marginTop:3}}>{cfg.formatDesc}</div>
            </div>
            <div style={{fontSize:36}}>
              {cfg.formatLabel==="SURGE"?"⚡":cfg.formatLabel==="FLOW"?"🌊":"💪"}
            </div>
          </div>

          {/* Session breakdown */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
            {[
              {label:"TOTAL TIME",   val:`~${totalMin}m`},
              cfg.mode==="STRENGTH"
                ? {label:"TOTAL SETS", val: cfg.blocks.reduce((a,b)=>a+b.sets,0)||"—"}
                : {label:"STATIONS",  val: cfg.blocks.length||"—"},
              {label:"WARMUP",       val:`${warmupMin}m`},
            ].map(s=>(
              <div key={s.label} style={{padding:"14px 10px",borderRadius:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",textAlign:"center"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,color:"#EEF2F8"}}>{s.val}</div>
                <div style={{fontSize:9,color:"rgba(238,242,248,0.35)",fontWeight:700,letterSpacing:"0.1em",marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Slot preview */}
          {cfg.blocks.length > 0 && (
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"rgba(238,242,248,0.35)",fontWeight:700,letterSpacing:"0.12em",marginBottom:10}}>EXERCISES</div>
              {cfg.blocks.map((b,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:11,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:24,height:24,borderRadius:6,background:`${cfg.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:800,color:cfg.color}}>{i+1}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:"#EEF2F8"}}>{b.exerciseName}</div>
                  </div>
                  <div style={{fontSize:11,color:"rgba(238,242,248,0.4)"}}>
                    {cfg.mode==="STRENGTH" ? `${b.sets} × ${b.reps}` : `${cfg.workSecs||b.workSecs}s`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warmup preview */}
          <div style={{padding:"14px",borderRadius:14,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",marginBottom:20}}>
            <div style={{fontSize:10,color:"#A78BFA",fontWeight:700,letterSpacing:"0.12em",marginBottom:8}}>WARMUP INCLUDED</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {cfg.warmup.map((w,i)=>(
                <div key={i} style={{padding:"4px 10px",borderRadius:20,background:"rgba(124,58,237,0.1)",fontSize:11,color:"rgba(238,242,248,0.6)"}}>{w.name}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Start buttons */}
        <div style={{padding:"16px 20px",paddingBottom:"max(20px,env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={start} style={{
            width:"100%",padding:"20px",borderRadius:16,border:"none",
            background:`linear-gradient(135deg,${cfg.color},${cfg.color}BB)`,
            color:"#000",fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,
            letterSpacing:"0.1em",cursor:"pointer",
            boxShadow:`0 8px 32px ${cfg.color}40`
          }}>▶ START {cfg.formatLabel}</button>
          <button onClick={()=>{
            // Skip warmup — find first PREPARE or WORK step
            const firstWorkIdx = seq.findIndex(s => s.phase === "PREPARE" || s.phase === "WORK");
            const idx = firstWorkIdx >= 0 ? firstWorkIdx : 0;
            seqIdxRef.current = idx;
            secsRef.current = seq[idx]?.secs || 10;
            runRef.current = true;
            setSeqIdx(idx);
            setSecs(seq[idx]?.secs || 10);
            setRunning(true);
            setStarted(true);
            setShowSetup(false);
            setTimeout(() => startTick(), 50);
          }} style={{
            width:"100%",padding:"12px",borderRadius:12,border:`1px solid rgba(255,255,255,0.1)`,
            background:"rgba(255,255,255,0.04)",
            color:"rgba(238,242,248,0.45)",fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,
            letterSpacing:"0.08em",cursor:"pointer"
          }}>SKIP WARMUP → GO STRAIGHT TO SETS</button>
        </div>
      </div>
    );
  }

  // ── ACTIVE TIMER SCREEN ───────────────────────────────────────────────────
  const isDone = cur.phase === "DONE";

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:300,
      background: isDone ? "#06080C" : ps.bg,
      fontFamily:"'Barlow Condensed',sans-serif",
      display:"flex",flexDirection:"column",
      transition:"background 0.35s ease",
      overflow:"hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes flash{0%{opacity:0;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes phaseDot{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
      `}</style>

      {/* Overall progress bar */}
      <div style={{height:4,background:"rgba(0,0,0,0.2)",flexShrink:0}}>
        <div style={{height:"100%",width:`${progressPct}%`,background:"rgba(255,255,255,0.5)",transition:"width 1s linear"}}/>
      </div>

      {/* Phase progress bar */}
      <div style={{height:4,background:"rgba(0,0,0,0.15)",flexShrink:0}}>
        <div style={{height:"100%",width:`${phaseProgressPct}%`,background:"rgba(0,0,0,0.35)",transition:"width 1s linear"}}/>
      </div>

      {/* Top bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",flexShrink:0}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:ps.text,opacity:0.55}}>{trackName}</div>
          {cur.slotIdx !== undefined && (
            <div style={{fontSize:15,color:ps.text,opacity:0.45}}>Station {(cur.slotIdx||0)+1}/{cfg.blocks.length}</div>
          )}
          {cur.setNum && (
            <div style={{fontSize:15,color:ps.text,opacity:0.45}}>Set {cur.setNum} of {cur.totalSets}</div>
          )}
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:800,color:ps.text,opacity:0.6,letterSpacing:"0.12em"}}>{cfg.formatLabel}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={reset} style={{width:34,height:34,borderRadius:9,background:"rgba(0,0,0,0.15)",border:"none",color:ps.text,opacity:0.65,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>↺</button>
          <button onClick={onClose} style={{width:34,height:34,borderRadius:9,background:"rgba(0,0,0,0.15)",border:"none",color:ps.text,opacity:0.65,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
      </div>

      {/* Phase label */}
      <div style={{textAlign:"center",padding:"4px 20px",flexShrink:0}}>
        <div key={`${seqIdx}-label`} style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontSize:56,fontWeight:900,letterSpacing:"0.08em",
          color:ps.text,
          animation:"flash 0.25s ease"
        }}>{cur.label}</div>
      </div>

      {/* Big countdown */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
        {!isDone ? (
          <>
            <div key={`${seqIdx}-secs`} style={{
              fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:"clamp(120px,34vw,220px)",
              fontWeight:900,lineHeight:0.88,
              color:ps.text,letterSpacing:"-0.02em",
              animation: (secs||0) <= 3 ? "pulse 0.5s ease infinite" : "flash 0.2s ease",
              userSelect:"none"
            }}>
              {fmtSecs(secs)}
            </div>

            {/* Exercise name + reps */}
            {cur.exercise && (
              <div key={`${seqIdx}-ex`} style={{marginTop:14,textAlign:"center",padding:"0 24px",animation:"slideUp 0.3s ease"}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:800,color:ps.text,opacity:0.9,letterSpacing:"0.04em"}}>{cur.exercise}</div>
                {cur.reps && <div style={{fontSize:17,color:ps.text,opacity:0.55,marginTop:4}}>{cur.reps}</div>}
              </div>
            )}

            {/* Next exercise on REST screens */}
            {cur.phase==="REST" && cur.nextExercise && (
              <div style={{marginTop:20,padding:"10px 20px",borderRadius:12,background:"rgba(0,0,0,0.15)",animation:"slideUp 0.3s ease"}}>
                <div style={{fontSize:13,color:ps.text,opacity:0.5,fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>NEXT UP</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:ps.text,opacity:0.8}}>{cur.nextExercise}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{textAlign:"center",padding:"0 24px",animation:"slideUp 0.4s ease"}}>
            <div style={{fontSize:64,marginBottom:12}}>🏆</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,color:"#F0C060",marginBottom:6}}>{workBlocks.length} SETS COMPLETE</div>
            <div style={{fontSize:15,color:"rgba(238,242,248,0.45)"}}>Total time: {fmtSecs(totalSecs)}</div>
          </div>
        )}
      </div>

      {/* Cycles/station dots for interval modes */}
      {!isDone && cfg.mode !== "STRENGTH" && cfg.blocks.length > 0 && (
        <div style={{display:"flex",justifyContent:"center",gap:8,padding:"8px 20px",flexShrink:0}}>
          {cfg.blocks.map((_,i)=>(
            <div key={i} style={{
              width:10,height:10,borderRadius:"50%",
              background: i === (cur.slotIdx||0) ? ps.text : "rgba(0,0,0,0.25)",
              transform: i===(cur.slotIdx||0) ? "scale(1.3)":"scale(1)",
              transition:"all 0.3s ease"
            }}/>
          ))}
        </div>
      )}

      {/* Set progress dots for STRENGTH */}
      {!isDone && cfg.mode === "STRENGTH" && cur.totalSets > 1 && (
        <div style={{display:"flex",justifyContent:"center",gap:8,padding:"8px 20px",flexShrink:0}}>
          {Array.from({length:cur.totalSets}).map((_,i)=>(
            <div key={i} style={{
              width:10,height:10,borderRadius:"50%",
              background: i < (cur.setNum||1)-1 ? "rgba(0,0,0,0.4)" : i===(cur.setNum||1)-1 ? ps.text : "rgba(0,0,0,0.2)",
              transition:"all 0.3s ease"
            }}/>
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div style={{background:"rgba(0,0,0,0.2)",padding:"16px 20px",paddingBottom:"max(20px,env(safe-area-inset-bottom))",flexShrink:0}}>
        {!isDone ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:0}}>
            {/* Work blocks done */}
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:42,fontWeight:900,color:ps.text,lineHeight:1}}>{workDone}</div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:ps.text,opacity:0.5,marginTop:2}}>DONE</div>
            </div>

            {/* Play/Pause + Skip */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,margin:"0 16px"}}>
              <button onClick={running?pause:resume} style={{
                width:68,height:68,borderRadius:"50%",
                border:`3px solid ${ps.text}`,background:"transparent",
                cursor:"pointer",color:ps.text,fontSize:24,
                display:"flex",alignItems:"center",justifyContent:"center",
                transition:"all 0.15s",flexShrink:0
              }}>
                {running?"⏸":"▶"}
              </button>
              {(cur.phase === "REST" || cur.phase === "TRANSITION") ? (
                <button onClick={skipRest} style={{
                  padding:"10px 18px",borderRadius:12,
                  background:"rgba(0,0,0,0.25)",border:`2px solid ${ps.text}`,
                  color:ps.text,cursor:"pointer",
                  fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,letterSpacing:"0.08em"
                }}>SKIP REST ⚡</button>
              ) : (
                <button onClick={skip} style={{
                  padding:"4px 14px",borderRadius:20,
                  background:"rgba(0,0,0,0.15)",border:"none",
                  color:ps.text,opacity:0.6,cursor:"pointer",
                  fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:"0.08em"
                }}>SKIP →</button>
              )}
            </div>

            {/* Blocks remaining */}
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:42,fontWeight:900,color:ps.text,lineHeight:1}}>{workBlocks.length-workDone}</div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:ps.text,opacity:0.5,marginTop:2}}>LEFT</div>
            </div>
          </div>
        ) : (
          <button onClick={()=>{reset();onClose();}} style={{
            width:"100%",padding:"18px",borderRadius:14,border:"none",
            background:trackColor,color:"#000",
            fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,
            letterSpacing:"0.08em",cursor:"pointer"
          }}>BACK TO WORKOUT</button>
        )}
      </div>
    </div>
  );
}
