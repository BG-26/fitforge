import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const BG      = "#06080C";
const SURFACE = "#0C1018";
const BORDER  = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT    = "#EEF2F8";
const MUTED   = "rgba(238,242,248,0.4)";
const FAINT   = "rgba(238,242,248,0.07)";
const GOLD    = "#F0C060";
const FD      = "'Barlow Condensed','Helvetica Neue',sans-serif";
const FB      = "'DM Sans','Helvetica Neue',sans-serif";
const TRACKS_COLOR = { FORGE:"#F87171", SURGE:"#F0C060", FLOW:"#5EEAD4" };

// ─── NUTRITION MODES ──────────────────────────────────────────────────────────
export const NUTRITION_MODES = {
  LOGGER: {
    id: "LOGGER",
    name: "Simple Logger",
    icon: "📓",
    tagline: "Just track what you eat.",
    desc: "Log meals, see calories. No targets, no coaching. Clean and simple.",
    color: "#60A5FA",
    pro: false,
    features: ["Food logging (voice + text)", "Daily calorie total", "Meal history"],
  },
  TRACKER: {
    id: "TRACKER",
    name: "Macro Tracker",
    icon: "📊",
    tagline: "Hit your numbers.",
    desc: "TDEE-based targets, macro rings, calorie burn balance. Data-driven.",
    color: GOLD,
    pro: false,
    features: ["Everything in Logger", "TDEE + macro targets", "Calorie burn vs intake", "Weekly trends", "Low protein alerts"],
  },
  COACH: {
    id: "COACH",
    name: "Nutrition Coach",
    icon: "🧠",
    tagline: "AI tells you what to eat and when.",
    desc: "Proactive coaching, meal suggestions, snack ideas, morning plans and evening recaps — personalised to your track and goals.",
    color: "#A78BFA",
    pro: true,
    features: ["Everything in Tracker", "AI meal suggestions", "Snack ideas by goal", "Morning plan + evening recap", "Post-workout meal timing", "Reminder system"],
  },
};

// Coach frequency options — user controls in settings
export const COACH_FREQUENCIES = {
  REACTIVE:   { id:"REACTIVE",   label:"Reactive only",           desc:"AI responds when you ask"               },
  POST_MEAL:  { id:"POST_MEAL",  label:"After each meal",         desc:"Quick nudge after every log entry"      },
  DAILY:      { id:"DAILY",      label:"Daily check-ins",         desc:"Morning plan + evening recap each day"  },
  FULL:       { id:"FULL",       label:"Full coaching",           desc:"All of the above, you're in the zone"   },
};

// ─── MEAL TYPES ───────────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { id:"breakfast",  label:"Breakfast",  icon:"🌅", hours:[5,10]  },
  { id:"lunch",      label:"Lunch",      icon:"☀️",  hours:[11,14] },
  { id:"snack",      label:"Snack",      icon:"🍎", hours:[0,24]  },
  { id:"dinner",     label:"Dinner",     icon:"🌙", hours:[17,21] },
  { id:"preworkout", label:"Pre-WO",     icon:"⚡", hours:[0,24]  },
  { id:"postworkout",label:"Post-WO",    icon:"💪", hours:[0,24]  },
];

function detectMealType() {
  const h = new Date().getHours();
  if (h >= 5  && h < 10) return "breakfast";
  if (h >= 11 && h < 14) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}

// ─── MACRO / TDEE FORMULAS ────────────────────────────────────────────────────
const TRACK_MACROS = {
  FORGE: { protein:0.35, carbs:0.40, fat:0.25, proteinLabel:"High protein — muscle building"         },
  SURGE: { protein:0.25, carbs:0.50, fat:0.25, proteinLabel:"Carb-fuelled — athletic performance"    },
  FLOW:  { protein:0.25, carbs:0.45, fat:0.30, proteinLabel:"Balanced macros — movement and recovery"},
};

function activityMult(sessions) {
  if (sessions <= 1) return 1.2;
  if (sessions <= 3) return 1.375;
  if (sessions <= 5) return 1.55;
  return 1.725;
}

export function calcTDEE(weightKg=75, heightCm=175, age=30, sex="unspecified", weeklySessions=3) {
  const bmr = sex === "male"
    ? (10*weightKg) + (6.25*heightCm) + (5*age) - 5
    : (10*weightKg) + (6.25*heightCm) + (5*age) - 161;
  return Math.round(bmr * activityMult(weeklySessions));
}

export function calcTargets(tdee, trackId="FORGE", goal="maintain", isRestDay=false) {
  const adj = { lose:-400, maintain:0, gain:300 };
  const restAdj = isRestDay ? -150 : 0;
  const calories = tdee + (adj[goal]||0) + restAdj;
  const m = TRACK_MACROS[trackId] || TRACK_MACROS.FORGE;
  return {
    calories,
    protein: Math.round((calories*m.protein)/4),
    carbs:   Math.round((calories*m.carbs)/4),
    fat:     Math.round((calories*m.fat)/9),
    proteinLabel: m.proteinLabel,
    isRestDay,
  };
}

// ─── NUTRITION STORE ──────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0,10);

export const NutritionStore = {
  getDay: (date=todayKey()) => {
    try { return JSON.parse(localStorage.getItem(`ff_nutrition_${date}`) || "[]"); }
    catch { return []; }
  },
  addEntry: (entry, date=todayKey()) => {
    try {
      const entries = NutritionStore.getDay(date);
      const e = { ...entry, id:Date.now(), timestamp:Date.now(), date };
      entries.push(e);
      localStorage.setItem(`ff_nutrition_${date}`, JSON.stringify(entries));
      return e;
    } catch { return null; }
  },
  deleteEntry: (id, date=todayKey()) => {
    try {
      const entries = NutritionStore.getDay(date).filter(e=>e.id!==id);
      localStorage.setItem(`ff_nutrition_${date}`, JSON.stringify(entries));
    } catch {}
  },
  getDayTotals: (date=todayKey()) =>
    NutritionStore.getDay(date).reduce((a,e) => ({
      calories: a.calories+(e.totalCalories||0),
      protein:  a.protein +(e.totalProtein||0),
      carbs:    a.carbs   +(e.totalCarbs||0),
      fat:      a.fat     +(e.totalFat||0),
    }), { calories:0, protein:0, carbs:0, fat:0 }),
  getWeek: () => {
    const days = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const entries = NutritionStore.getDay(key);
      const totals  = NutritionStore.getDayTotals(key);
      days.push({
        date:key,
        label: i===0?"Today":i===1?"Yesterday":d.toLocaleDateString("en",{weekday:"short"}),
        entries, totals,
      });
    }
    return days;
  },
  getNutritionMode: () => localStorage.getItem("ff_nutrition_mode") || "LOGGER",
  setNutritionMode: (mode) => localStorage.setItem("ff_nutrition_mode", mode),
  getCoachFreq: () => localStorage.getItem("ff_coach_freq") || "REACTIVE",
  setCoachFreq: (f) => localStorage.setItem("ff_coach_freq", f),
  getProStatus: () => localStorage.getItem("ff_pro") === "true",
  setProStatus: (v) => localStorage.setItem("ff_pro", String(v)),
};

// ─── AI FOOD PARSER ───────────────────────────────────────────────────────────
export async function parseFoodWithAI(input, mealType="snack") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_KEY||"","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001",
      max_tokens:600,
      messages:[{ role:"user", content:
`You are FitForge's nutrition AI. Parse this food log entry and return ONLY valid JSON, no markdown.

User said: "${input}"
Meal type: ${mealType}

Rules:
- "a bowl" = 1.5 cups standard, "a big bowl" = 2 cups
- "a handful" = 30g, "a small piece" = 0.75× standard
- Use realistic macro estimates for whole foods
- Be concise with item names (max 4 words)

Return this exact JSON:
{
  "items": [{"name":"","quantity":"","calories":0,"protein":0,"carbs":0,"fat":0}],
  "mealType":"${mealType}",
  "totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,
  "confidence":"high",
  "notes":""
}
confidence: high=portions clear, medium=estimated, low=very vague.
notes: brief if anything assumed. Calculate totals from items. Return only JSON.` }]
    })
  });
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim()||"";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ─── AI COACH ENGINE ──────────────────────────────────────────────────────────
export async function getCoachSuggestion(type, context) {
  const prompts = {
    morning_plan: `You are FitForge's nutrition coach. User: ${context.name}, Track: ${context.track}, Goal: ${context.goal||"maintain"}.
Today is a ${context.isRestDay?"rest":"training"} day. Daily calorie target: ${context.targets?.calories}kcal, protein: ${context.targets?.protein}g.
Give a concise morning nutrition plan: suggested breakfast + timing of meals today. Max 80 words. Be direct and specific, not generic.`,

    post_meal: `FitForge nutrition coach. User just logged: ${context.mealName} (${context.calories}kcal, ${context.protein}g protein).
Track: ${context.track}. Daily remaining: ${context.remaining?.calories}kcal, ${context.remaining?.protein}g protein.
Give one specific, actionable next-meal suggestion. Max 40 words. Direct, not preachy.`,

    snack_idea: `FitForge nutrition coach. User: Track ${context.track}, ${context.remaining?.protein}g protein remaining today, it's ${context.timeOfDay}.
Suggest 2 quick snack ideas that hit protein. Max 50 words total. Specific portions.`,

    evening_recap: `FitForge nutrition coach. Today's log: ${context.calories}kcal eaten, ${context.protein}g protein, target ${context.targets?.calories}kcal / ${context.targets?.protein}g.
Track: ${context.track}. Give a 2-sentence recap: what they did well + one thing to improve tomorrow. Direct, encouraging.`,

    low_protein: `FitForge coach. It's ${context.timeOfDay} and user has only hit ${context.protein}g of ${context.targets?.protein}g protein target. Track: ${context.track}.
Suggest one high-protein meal or snack to close the gap. Under 35 words. Specific.`,

    post_workout: `FitForge nutrition coach. Athlete just completed a ${context.track} session (${context.duration||"~45 min"}).
Today's log so far: ${context.calories}kcal, ${context.protein}g protein. Targets: ${context.targets?.calories}kcal / ${context.targets?.protein}g protein.
Give a specific post-workout refuel recommendation — what to eat and when. Max 60 words. Direct and practical.`,

    chat: context.message,
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_KEY||"","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001",
      max_tokens: type==="chat" ? 300 : 150,
      messages:[{ role:"user", content: prompts[type]||prompts.snack_idea }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim()||"";
}

// ─── REMINDER SYSTEM ──────────────────────────────────────────────────────────
export const ReminderEngine = {
  requestPermission: async () => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    const result = await Notification.requestPermission();
    return result;
  },
  send: (title, body, icon="🎙") => {
    if (Notification.permission === "granted") {
      new Notification(`${icon} ${title}`, { body, icon:"/favicon.ico", badge:"/favicon.ico", silent:false });
    }
  },
  getPermission: () => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  },
  scheduleDaily: (hour, title, body) => {
    // In PWA: use service worker + push API for true background scheduling
    // For now: set a flag + check on app open via checkDailyReminders()
    const reminders = JSON.parse(localStorage.getItem("ff_reminders")||"[]");
    const key = `daily_${hour}`;
    const existing = reminders.findIndex(r=>r.key===key);
    const entry = { key, hour, title, body, enabled:true };
    if (existing>=0) reminders[existing]=entry; else reminders.push(entry);
    localStorage.setItem("ff_reminders", JSON.stringify(reminders));
  },
  checkDailyReminders: () => {
    const reminders = JSON.parse(localStorage.getItem("ff_reminders")||"[]");
    const now = new Date();
    const todayFired = JSON.parse(localStorage.getItem(`ff_reminders_fired_${todayKey()}`)||"[]");
    reminders.filter(r=>r.enabled && !todayFired.includes(r.key) && now.getHours()>=r.hour).forEach(r=>{
      ReminderEngine.send(r.title, r.body);
      todayFired.push(r.key);
    });
    localStorage.setItem(`ff_reminders_fired_${todayKey()}`, JSON.stringify(todayFired));
  },
};

// ─── VOICE INPUT HOOK ─────────────────────────────────────────────────────────
export function useVoiceFoodInput({ onResult, onWakeWord }) {
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported,  setSupported]  = useState(false);
  const [micError,   setMicError]   = useState(null);
  const [wakeActive, setWakeActive] = useState(false);
  const recogRef = useRef(null);
  const wakeRef  = useRef(null);
  const wakeLoop = useRef(false);

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition||window.webkitSpeechRecognition));
    ReminderEngine.checkDailyReminders();
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) return;
    setMicError(null);
    recogRef.current?.stop();
    const r = new SR();
    r.continuous=false; r.interimResults=true; r.lang="en-US";
    r.onstart = ()=>setListening(true);
    r.onend   = ()=>setListening(false);
    r.onresult = (e) => {
      const t = Array.from(e.results).map(x=>x[0].transcript).join(" ");
      setTranscript(t);
      if (e.results[e.results.length-1].isFinal) { onResult?.(t.trim()); setTranscript(""); }
    };
    r.onerror = (e)=>{
      setListening(false); setTranscript("");
      if (e.error === "not-allowed") setMicError("Microphone access denied — check browser permissions.");
      else if (e.error === "no-speech") setMicError(null); // silent, user just didn't speak
      else setMicError("Mic unavailable — try again.");
    };
    recogRef.current=r; r.start();
  }, [onResult]);

  const stopListening = useCallback(() => { recogRef.current?.stop(); setListening(false); }, []);

  const enableWakeWord = useCallback(() => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) return;
    wakeLoop.current=true; setWakeActive(true);
    const start = () => {
      if (!wakeLoop.current) return;
      const r = new SR();
      r.continuous=false; r.interimResults=false; r.lang="en-US";
      r.onresult = (e) => {
        const t = e.results[0][0].transcript.toLowerCase();
        if (t.includes("hey fitforge")||t.includes("hi fitforge")||t.includes("fitforge")) {
          onWakeWord?.();
        }
      };
      r.onend  = ()=>{ if(wakeLoop.current) setTimeout(start,300); };
      r.onerror= ()=>{ if(wakeLoop.current) setTimeout(start,1000); };
      wakeRef.current=r; r.start();
    };
    start();
  }, [onWakeWord]);

  const disableWakeWord = useCallback(() => {
    wakeLoop.current=false; setWakeActive(false);
    wakeRef.current?.stop();
  }, []);

  return { listening, transcript, supported, micError, wakeActive, startListening, stopListening, enableWakeWord, disableWakeWord };
}

// ─── MINI UI HELPERS ──────────────────────────────────────────────────────────
function MacroRing({ value, target, color, label, size=68 }) {
  const [anim, setAnim] = useState(0);
  useEffect(()=>{ setTimeout(()=>setAnim(Math.min(1,target>0?value/target:0)),200); },[value,target]);
  const r=26,cx=size/2,cy=size/2,circ=2*Math.PI*r;
  const over=value>target&&target>0;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={FAINT} strokeWidth="4.5"/>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={over?"#F87171":color} strokeWidth="4.5"
          strokeDasharray={circ} strokeDashoffset={circ*(1-anim)}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{transition:"stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
          fill={over?"#F87171":color} fontSize="11" fontFamily={FD} fontWeight="800">
          {Math.round(anim*100)}%
        </text>
      </svg>
      <div style={{fontSize:11,fontWeight:700,color:over?"#F87171":color,marginTop:2}}>{value}g</div>
      <div style={{fontSize:9,color:MUTED,marginTop:1}}>{label}</div>
    </div>
  );
}

function CalBar({ consumed, target, burned=0, color=GOLD }) {
  const [w,setW]=useState(0);
  const pct=target>0?Math.min(1,consumed/target):0;
  const over=consumed>target&&target>0;
  useEffect(()=>{ setTimeout(()=>setW(pct*100),120); },[consumed,target]);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
        <div>
          <div style={{fontFamily:FD,fontSize:48,fontWeight:800,color:over?"#F87171":TEXT,lineHeight:1,letterSpacing:"-0.02em"}}>{consumed.toLocaleString()}</div>
          <div style={{fontSize:12,color:MUTED,marginTop:3}}>of {target>0?target.toLocaleString():"—"} kcal{target>0?" target":""}</div>
        </div>
        <div style={{textAlign:"right"}}>
          {burned>0&&<div style={{fontSize:12,color:"#FB923C",fontWeight:600}}>−{burned} burned</div>}
          {target>0&&<div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:over?"#F87171":color,marginTop:2}}>
            {over?`+${(consumed-target).toLocaleString()} over`:`${Math.max(0,target-consumed+burned).toLocaleString()} left`}
          </div>}
        </div>
      </div>
      {target>0&&(
        <div style={{height:6,background:FAINT,borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${w}%`,borderRadius:3,
            background:over?`linear-gradient(90deg,${color},#F87171)`:`linear-gradient(90deg,${color}70,${color})`,
            transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
        </div>
      )}
    </div>
  );
}

// ─── AI COACH CARD ─────────────────────────────────────────────────────────────
function CoachCard({ type, context, color="#A78BFA", autoLoad=false }) {
  const [msg,  setMsg]  = useState("");
  const [loading,setLoading]=useState(false);
  const [shown, setShown] = useState(false);

  useEffect(()=>{ if(autoLoad){ load(); } },[]);

  const load = async () => {
    if (loading||msg) return;
    setLoading(true);
    try { setMsg(await getCoachSuggestion(type,context)); setShown(true); }
    catch { setMsg("Couldn't load suggestion — tap to retry."); }
    finally { setLoading(false); }
  };

  const ICONS = { morning_plan:"🌅", post_meal:"💬", snack_idea:"🍎", evening_recap:"🌙", low_protein:"⚡" };
  const LABELS= { morning_plan:"Morning Plan", post_meal:"Meal Insight", snack_idea:"Snack Idea", evening_recap:"Evening Recap", low_protein:"Protein Alert" };

  return (
    <div style={{padding:"14px 16px",borderRadius:14,background:`${color}08`,border:`1px solid ${color}25`,marginBottom:12,fontFamily:FB}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:msg?8:0}}>
        <div style={{fontSize:11,color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
          {ICONS[type]} {LABELS[type]}
        </div>
        {!msg&&!loading&&(
          <button onClick={load} style={{padding:"5px 12px",borderRadius:8,background:`${color}15`,border:`1px solid ${color}30`,color,cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:600}}>
            Get suggestion
          </button>
        )}
        {loading&&<div style={{fontSize:12,color:MUTED}}>Thinking…</div>}
      </div>
      {msg&&<div style={{fontSize:13,color:TEXT,lineHeight:1.65}}>{msg}</div>}
    </div>
  );
}

// ─── FOOD LOG MODAL ───────────────────────────────────────────────────────────
function FoodLogModal({ user, targets, onSave, onClose, defaultMeal, prefillText="", autoListen=false }) {
  const COLOR = TRACKS_COLOR[user?.track]||GOLD;
  const [input,   setInput]   = useState(prefillText);
  const [meal,    setMeal]    = useState(defaultMeal||detectMealType());
  const [parsing, setParsing] = useState(false);
  const [parsed,  setParsed]  = useState(null);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);
  const textRef = useRef();

  const { listening, transcript, supported, micError, startListening, stopListening } = useVoiceFoodInput({
    onResult:(t)=>{ setInput(t); parseIt(t); }
  });

  useEffect(()=>{ if(prefillText){ parseIt(prefillText); } },[]);
  useEffect(()=>{ if(transcript) setInput(transcript); },[transcript]);
  // Auto-start listening when opened from mic button
  useEffect(()=>{ if(autoListen && supported) { const t = setTimeout(startListening, 300); return ()=>clearTimeout(t); } },[supported]);

  async function parseIt(txt=input) {
    if (!txt.trim()) return;
    setParsing(true); setParsed(null); setError(null);
    try {
      const r = await parseFoodWithAI(txt, meal);
      const totals = r.items.reduce((a,i)=>({
        totalCalories:a.totalCalories+(i.calories||0),
        totalProtein: a.totalProtein +(i.protein||0),
        totalCarbs:   a.totalCarbs   +(i.carbs||0),
        totalFat:     a.totalFat     +(i.fat||0),
      }),{totalCalories:0,totalProtein:0,totalCarbs:0,totalFat:0});
      setParsed({...r,...totals});
    } catch { setError("Couldn't parse that — try being a bit more specific."); }
    finally  { setParsing(false); }
  }

  function save() {
    if (!parsed) return;
    NutritionStore.addEntry({ ...parsed, mealType:meal, rawInput:input });
    onSave?.();
    setSaved(true);
    setTimeout(onClose, 700);
  }

  const CC = { high:"#34D399", medium:GOLD, low:"#FB923C" };

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(6,8,12,0.93)",display:"flex",alignItems:"flex-end",fontFamily:FB}}>
      <style>{`
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
      `}</style>
      <div style={{width:"100%",maxWidth:500,margin:"0 auto",background:SURFACE,borderRadius:"24px 24px 0 0",
        border:`1px solid ${BORDER2}`,borderBottom:"none",padding:"22px 22px 44px",
        maxHeight:"92vh",overflowY:"auto",animation:"slideUp 0.28s cubic-bezier(0.22,1,0.36,1)"}}>

        <div style={{width:36,height:4,borderRadius:2,background:BORDER2,margin:"0 auto 20px"}}/>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontFamily:FD,fontSize:26,fontWeight:800,letterSpacing:"0.04em"}}>LOG FOOD</div>
          <button onClick={onClose} style={{padding:"6px 12px",borderRadius:8,background:FAINT,border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13}}>✕</button>
        </div>

        {/* Meal type pills */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16,scrollbarWidth:"none"}}>
          {MEAL_TYPES.map(m=>(
            <button key={m.id} onClick={()=>setMeal(m.id)} style={{
              flexShrink:0,padding:"7px 13px",borderRadius:20,whiteSpace:"nowrap",
              border:`1.5px solid ${meal===m.id?COLOR:BORDER2}`,
              background:meal===m.id?`${COLOR}12`:SURFACE,
              color:meal===m.id?COLOR:MUTED,
              cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:meal===m.id?700:400,
              transition:"all 0.15s"
            }}>{m.icon} {m.label}</button>
          ))}
        </div>

        {/* Text area */}
        <div style={{position:"relative",marginBottom:12}}>
          <textarea
            ref={textRef} value={input} rows={3}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();parseIt();} }}
            placeholder={listening?"Listening…":"What did you eat? Tap mic or type here…"}
            style={{width:"100%",background:BG,border:`1.5px solid ${listening?COLOR:input?COLOR+"50":BORDER2}`,
              borderRadius:14,padding:"14px 52px 14px 16px",color:TEXT,
              fontFamily:FB,fontSize:14,outline:"none",resize:"none",lineHeight:1.6,transition:"border-color 0.2s"}}
          />
          {supported&&(
            <button onClick={listening?stopListening:startListening} style={{
              position:"absolute",right:10,top:10,width:34,height:34,borderRadius:"50%",
              background:listening?COLOR:FAINT,border:`1px solid ${listening?COLOR:BORDER2}`,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:16,transition:"all 0.2s",boxShadow:listening?`0 0 14px ${COLOR}50`:"none"
            }}>🎙</button>
          )}
        </div>

        {listening&&transcript&&(
          <div style={{padding:"8px 12px",borderRadius:10,background:`${COLOR}10`,border:`1px solid ${COLOR}30`,marginBottom:10,fontSize:13,color:COLOR,fontStyle:"italic"}}>
            "{transcript}…"
          </div>
        )}
        {micError&&(
          <div style={{padding:"8px 12px",borderRadius:10,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",marginBottom:10,fontSize:12,color:"#F87171"}}>
            🎙 {micError}
          </div>
        )}

        {!parsed&&(
          <button disabled={!input.trim()||parsing} onClick={()=>parseIt()} style={{
            width:"100%",padding:"15px",borderRadius:13,border:"none",
            background:input.trim()&&!parsing?COLOR:FAINT,
            color:input.trim()&&!parsing?BG:MUTED,
            fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.08em",
            cursor:input.trim()&&!parsing?"pointer":"not-allowed",transition:"all 0.2s"
          }}>{parsing?"ANALYSING…":"ANALYSE FOOD →"}</button>
        )}

        {parsing&&(
          <div style={{textAlign:"center",padding:"24px",color:MUTED,fontSize:13}}>
            <div style={{fontSize:36,marginBottom:10,display:"inline-block",animation:"spin 1s linear infinite"}}>🔍</div>
            <div>Reading your meal…</div>
          </div>
        )}

        {error&&<div style={{padding:"12px 14px",borderRadius:12,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",fontSize:13,color:"#F87171",marginTop:8}}>{error}</div>}

        {parsed&&!saved&&(
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700}}>Here's what I found:</div>
              <span style={{fontSize:10,padding:"3px 9px",borderRadius:6,fontWeight:700,
                background:`${CC[parsed.confidence]}15`,color:CC[parsed.confidence]}}>
                {parsed.confidence} confidence
              </span>
            </div>

            <div style={{background:BG,borderRadius:13,marginBottom:12,border:`1px solid ${BORDER2}`}}>
              {parsed.items?.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"11px 14px",borderBottom:i<parsed.items.length-1?`1px solid ${BORDER}`:"none"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{item.name}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>{item.quantity}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:FD,fontSize:16,fontWeight:800,color:GOLD}}>{item.calories}</div>
                    <div style={{fontSize:10,color:MUTED}}>kcal</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{padding:"14px 16px",borderRadius:13,background:`${COLOR}08`,border:`1px solid ${COLOR}20`,marginBottom:parsed.notes?10:14}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
                {[{l:"Calories",v:parsed.totalCalories,u:"kcal",c:GOLD},{l:"Protein",v:parsed.totalProtein,u:"g",c:"#F87171"},{l:"Carbs",v:parsed.totalCarbs,u:"g",c:"#60A5FA"},{l:"Fat",v:parsed.totalFat,u:"g",c:"#FB923C"}].map(s=>(
                  <div key={s.l}>
                    <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:9,color:MUTED,marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {parsed.notes&&<div style={{padding:"9px 12px",borderRadius:10,background:FAINT,fontSize:12,color:MUTED,marginBottom:12,fontStyle:"italic"}}>💬 {parsed.notes}</div>}

            {targets&&parsed.totalProtein>0&&(
              <div style={{padding:"9px 12px",borderRadius:10,background:FAINT,marginBottom:14,fontSize:12,color:MUTED}}>
                {parsed.totalProtein>=targets.protein*0.25
                  ?`✅ Good protein — ${parsed.totalProtein}g toward your ${targets.protein}g daily target`
                  :`💡 Low protein (${parsed.totalProtein}g) — consider adding a protein source`}
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setParsed(null);setInput("");}} style={{padding:"14px",borderRadius:12,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13}}>Edit</button>
              <button onClick={save} style={{padding:"14px",borderRadius:12,border:"none",background:COLOR,color:BG,cursor:"pointer",fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.06em",boxShadow:`0 4px 16px ${COLOR}30`}}>LOG IT ✓</button>
            </div>
          </div>
        )}

        {saved&&<div style={{textAlign:"center",padding:"20px",animation:"fadeUp 0.3s ease"}}>
          <div style={{fontSize:48,marginBottom:8}}>✅</div>
          <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:"#34D399"}}>LOGGED!</div>
        </div>}
      </div>
    </div>
  );
}

// ─── PRO UPSELL GATE ──────────────────────────────────────────────────────────
function ProUpsellCard({ onUnlock, color="#A78BFA" }) {
  return (
    <div style={{padding:"24px 20px",borderRadius:20,background:`${color}08`,
      border:`1.5px solid ${color}30`,fontFamily:FB,textAlign:"center",marginBottom:16}}>
      <div style={{fontSize:40,marginBottom:12}}>🧠</div>
      <div style={{fontFamily:FD,fontSize:28,fontWeight:800,letterSpacing:"0.04em",color,marginBottom:6}}>NUTRITION COACH</div>
      <div style={{fontSize:13,color:MUTED,lineHeight:1.7,marginBottom:20}}>
        AI-powered meal suggestions, snack ideas, morning plans, evening recaps, and reminders — all personalised to your {`track`} and goals.
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:20,textAlign:"left"}}>
        {NUTRITION_MODES.COACH.features.map((f,i)=>(
          <div key={i} style={{fontSize:12,color:i<2?MUTED:TEXT,display:"flex",gap:8,alignItems:"center"}}>
            <span style={{color:i<2?MUTED:color}}>✓</span>{f}
          </div>
        ))}
      </div>
      {/* In production: wire to payment provider */}
      <button onClick={onUnlock} style={{width:"100%",padding:"16px",borderRadius:13,border:"none",
        background:`linear-gradient(135deg,${color},#7C3AED)`,
        color:"#fff",fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
        cursor:"pointer",boxShadow:`0 6px 24px ${color}40`}}>
        UNLOCK COACH — PRO
      </button>
      <div style={{fontSize:11,color:MUTED,marginTop:10}}>Connect to your payment provider to go live</div>
    </div>
  );
}

// ─── FLOATING MIC BUTTON ─────────────────────────────────────────────────────
export function FloatingMicButton({ user, targets, onLogSaved }) {
  const COLOR = TRACKS_COLOR[user?.track]||GOLD;
  const [showModal, setShowModal] = useState(false);
  const [prefill,   setPrefill]   = useState("");
  const [pulse,     setPulse]     = useState(false);
  const [showTip,   setShowTip]   = useState(false);
  const [wakeSettingOn] = useState(()=>localStorage.getItem("ff_wake_word")==="true");

  const { supported, wakeActive, startListening, stopListening, listening,
          enableWakeWord, disableWakeWord, transcript } = useVoiceFoodInput({
    onResult:(t)=>{ setPrefill(t); setShowModal(true); },
    onWakeWord:()=>{ setPulse(true); setTimeout(()=>setPulse(false),1000); setShowModal(true); },
  });

  // Auto-enable wake word if user had it on
  useEffect(()=>{
    if(wakeSettingOn&&supported) enableWakeWord();
  },[]);

  return (
    <>
      <style>{`
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 ${COLOR}50}60%{box-shadow:0 0 0 14px ${COLOR}00}}
        @keyframes wakeRing{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      <div style={{position:"fixed",right:18,bottom:86,display:"flex",flexDirection:"column",alignItems:"center",gap:8,zIndex:100}}>

        {/* Wake word indicator — only shown when active */}
        {wakeActive&&(
          <div style={{
            padding:"4px 10px",borderRadius:20,
            background:"rgba(52,211,153,0.12)",border:"1px solid rgba(52,211,153,0.3)",
            display:"flex",alignItems:"center",gap:5,animation:"fadeIn 0.3s ease"
          }}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#34D399",animation:"micPulse 1.5s ease infinite"}}/>
            <span style={{fontSize:9,color:"#34D399",fontWeight:700,letterSpacing:"0.08em"}}>LISTENING</span>
          </div>
        )}

        {/* Main mic button */}
        <button
          onClick={()=>{
            setPrefill("");
            setShowModal(true);
          }}
          onLongPress={()=>setShowTip(true)}
          style={{
            width:56,height:56,borderRadius:"50%",border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${COLOR},${COLOR}AA)`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
            boxShadow:`0 4px 20px ${COLOR}40`,
            animation:pulse?"wakeRing 0.4s ease":listening?"micPulse 1.2s ease infinite":"none",
            transition:"transform 0.15s",
          }}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
        >🎙</button>

        <div style={{fontSize:9,color:MUTED,fontWeight:600,letterSpacing:"0.06em",textAlign:"center"}}>
          {wakeActive?"HEY FITFORGE":"LOG FOOD"}
        </div>
        {wakeActive&&(
          <div style={{
            position:"absolute",bottom:"100%",right:0,marginBottom:10,
            padding:"8px 12px",borderRadius:10,background:SURFACE,border:`1px solid ${BORDER2}`,
            fontSize:10,color:MUTED,lineHeight:1.5,maxWidth:200,whiteSpace:"normal",textAlign:"left",
            boxShadow:"0 4px 16px rgba(0,0,0,0.4)"
          }}>
            <span style={{color:"#34D399",fontWeight:700}}>👂 Listening for "Hey FitForge"</span><br/>
            Processed on-device only. Nothing is recorded or sent anywhere.
          </div>
        )}
      </div>

      {showModal&&(
        <FoodLogModal user={user} targets={targets} prefillText={prefill}
          autoListen={true}
          onSave={()=>{ onLogSaved?.(); setShowModal(false); }}
          onClose={()=>{ setShowModal(false); setPrefill(""); }}/>
      )}
    </>
  );
}

// ─── ONBOARDING STEP: NUTRITION MODE ─────────────────────────────────────────
// Drop into App.jsx Onboarding flow after track selection (step 4 → becomes step 5)
export function NutritionModeStep({ onSelect, trackColor=GOLD }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{fontFamily:FB,color:TEXT,padding:"0 4px"}}>
      <div style={{fontSize:10,color:trackColor,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>STEP 5 OF 9</div>
      <h2 style={{fontFamily:FD,fontSize:34,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:6}}>How do you want to<br/><span style={{color:trackColor}}>track nutrition?</span></h2>
      <p style={{fontSize:13,color:MUTED,lineHeight:1.6,marginBottom:24}}>You can change this anytime in settings.</p>

      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
        {Object.values(NUTRITION_MODES).map(mode=>(
          <button key={mode.id} onClick={()=>setSelected(mode.id)} style={{
            padding:"18px 20px",borderRadius:18,border:`2px solid ${selected===mode.id?mode.color:BORDER2}`,
            background:selected===mode.id?`${mode.color}08`:SURFACE,
            cursor:"pointer",textAlign:"left",transition:"all 0.15s",
            boxShadow:selected===mode.id?`0 4px 20px ${mode.color}20`:"none"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:26}}>{mode.icon}</span>
                <div>
                  <div style={{fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.04em",color:selected===mode.id?mode.color:TEXT}}>
                    {mode.name}
                  </div>
                  <div style={{fontSize:11,color:mode.color,fontWeight:600,marginTop:1}}>{mode.tagline}</div>
                </div>
              </div>
              {mode.pro&&<span style={{fontSize:10,padding:"3px 9px",borderRadius:6,background:`${mode.color}15`,color:mode.color,fontWeight:700}}>PRO</span>}
            </div>
            <div style={{fontSize:12,color:MUTED,lineHeight:1.6,marginLeft:36}}>{mode.desc}</div>
          </button>
        ))}
      </div>

      <button disabled={!selected} onClick={()=>{ NutritionStore.setNutritionMode(selected); onSelect(selected); }} style={{
        width:"100%",padding:"18px",borderRadius:14,border:"none",
        background:selected?NUTRITION_MODES[selected]?.color:FAINT,
        color:selected?BG:MUTED,
        fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
        cursor:selected?"pointer":"not-allowed",transition:"all 0.2s",
        boxShadow:selected?`0 6px 24px ${NUTRITION_MODES[selected]?.color}30`:"none"
      }}>CONTINUE →</button>
    </div>
  );
}

// ─── MAIN FOOD TRACKER TAB ───────────────────────────────────────────────────
export function FoodTrackerTab({ user, sessionCaloriesBurned=0 }) {
  const COLOR = TRACKS_COLOR[user?.track]||GOLD;
  const [mode,    setMode]    = useState(()=>NutritionStore.getNutritionMode());
  const [coachFreq,setCoachFreq]=useState(()=>NutritionStore.getCoachFreq());
  const [isPro,   setIsPro]   = useState(()=>NutritionStore.getProStatus());
  const [view,    setView]    = useState("today");
  const [entries, setEntries] = useState([]);
  const [showModal,setShowModal]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [notifPerm,setNotifPerm]=useState(()=>ReminderEngine.getPermission());

  const isRestDay = !entries.length && new Date().getDay()===0; // simple heuristic
  const tdee    = calcTDEE(user?.weightKg||75, user?.heightCm||175, user?.age||30, user?.sex, 3);
  const targets = mode!=="LOGGER" ? calcTargets(tdee, user?.track||"FORGE", user?.goal||"maintain", isRestDay) : null;
  // Derive totals from entries state so it's reactive
  const totals  = entries.reduce((a,e)=>({
    calories: a.calories+(e.totalCalories||0),
    protein:  a.protein +(e.totalProtein||0),
    carbs:    a.carbs   +(e.totalCarbs||0),
    fat:      a.fat     +(e.totalFat||0),
  }),{calories:0,protein:0,carbs:0,fat:0});
  const weekData = NutritionStore.getWeek();
  const h = new Date().getHours();
  const timeOfDay = h<12?"morning":h<17?"afternoon":"evening";

  useEffect(()=>{ setEntries(NutritionStore.getDay()); },[showModal]);
  const refresh = ()=>{ setEntries(NutritionStore.getDay()); };

  const grouped = MEAL_TYPES.map(m=>({
    ...m, items:entries.filter(e=>e.mealType===m.id),
    total:entries.filter(e=>e.mealType===m.id).reduce((s,e)=>s+(e.totalCalories||0),0),
  })).filter(m=>m.items.length>0);

  const remaining = targets ? {
    calories:Math.max(0,targets.calories-totals.calories+sessionCaloriesBurned),
    protein: Math.max(0,targets.protein-totals.protein),
  } : null;

  const lowProtein = targets && totals.protein < targets.protein*0.40 && h>15;
  const showEveningRecap = targets && h>=19 && totals.calories>0;
  const showMorningPlan  = targets && h<10  && totals.calories===0;

  async function enableNotifications() {
    const result = await ReminderEngine.requestPermission();
    setNotifPerm(result);
    if (result==="granted") {
      ReminderEngine.scheduleDaily(8,  "Morning fuel plan", "Tap to see today's nutrition plan");
      ReminderEngine.scheduleDaily(20, "Evening recap",     "How did your nutrition look today?");
    }
  }

  // Simulate pro unlock (wire to payment provider in production)
  function unlockPro() {
    NutritionStore.setProStatus(true); setIsPro(true);
    NutritionStore.setNutritionMode("COACH"); setMode("COACH");
  }

  return (
    <div style={{padding:"24px 22px 0",fontFamily:FB,color:TEXT}}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>NUTRITION</div>
          <h2 style={{fontFamily:FD,fontSize:32,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95}}>
            {view==="today"?"Today's":"Weekly"}<br/><span style={{color:COLOR}}>fuel log.</span>
          </h2>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Mode badge */}
          <div style={{padding:"5px 10px",borderRadius:20,background:`${NUTRITION_MODES[mode]?.color}15`,border:`1px solid ${NUTRITION_MODES[mode]?.color}30`,fontSize:10,color:NUTRITION_MODES[mode]?.color,fontWeight:700,cursor:"pointer"}}
            onClick={()=>setShowSettings(true)}>
            {NUTRITION_MODES[mode]?.icon} {NUTRITION_MODES[mode]?.name.split(" ")[0]}
          </div>
          <button onClick={()=>setShowModal(true)} style={{padding:"11px 16px",borderRadius:12,border:"none",background:COLOR,color:BG,fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.06em",cursor:"pointer",boxShadow:`0 4px 16px ${COLOR}30`}}>
            + LOG
          </button>
        </div>
      </div>

      {/* Today / Week tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20,padding:"4px",background:FAINT,borderRadius:12}}>
        {["today","week"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px",borderRadius:9,border:"none",
            background:view===v?SURFACE:"transparent",color:view===v?TEXT:MUTED,
            cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800,
            letterSpacing:"0.06em",textTransform:"uppercase",transition:"all 0.15s"}}>{v}</button>
        ))}
      </div>

      {/* ── TODAY VIEW ── */}
      {view==="today"&&(
        <div style={{animation:"fadeIn 0.2s ease"}}>

          {/* Calorie card */}
          <div style={{padding:"20px",borderRadius:18,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:14}}>
            <CalBar consumed={totals.calories} target={targets?.calories||0} burned={sessionCaloriesBurned} color={COLOR}/>
          </div>

          {/* Macro rings — TRACKER + COACH only */}
          {mode!=="LOGGER"&&targets&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[{l:"Protein",v:totals.protein,t:targets.protein,c:"#F87171"},{l:"Carbs",v:totals.carbs,t:targets.carbs,c:"#60A5FA"},{l:"Fat",v:totals.fat,t:targets.fat,c:"#FB923C"}].map(m=>(
                <div key={m.l} style={{padding:"14px 8px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,display:"flex",justifyContent:"center"}}>
                  <MacroRing value={m.v} target={m.t} color={m.c} label={`${m.l}/${m.t}g`}/>
                </div>
              ))}
            </div>
          )}

          {/* Net calorie balance */}
          {mode!=="LOGGER"&&sessionCaloriesBurned>0&&(
            <div style={{padding:"12px 16px",borderRadius:12,background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:MUTED}}>🔥 Net after workout</span>
              <span style={{fontFamily:FD,fontSize:20,fontWeight:800,color:"#FB923C"}}>{(totals.calories-sessionCaloriesBurned).toLocaleString()} kcal</span>
            </div>
          )}

          {/* Rest day note */}
          {mode!=="LOGGER"&&isRestDay&&targets?.isRestDay&&(
            <div style={{padding:"10px 14px",borderRadius:11,background:`${COLOR}08`,border:`1px solid ${COLOR}20`,marginBottom:14,fontSize:12,color:MUTED}}>
              🛋 Rest day — calorie target adjusted −150 kcal for lower activity.
            </div>
          )}

          {/* Low protein alert */}
          {mode!=="LOGGER"&&lowProtein&&(
            <div style={{padding:"12px 14px",borderRadius:12,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",marginBottom:14}}>
              <div style={{fontSize:12,color:"#F87171",fontWeight:700,marginBottom:3}}>⚠ Low protein — {timeOfDay}</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.5}}>{totals.protein}g of {targets.protein}g logged. {targets.proteinLabel}.</div>
            </div>
          )}

          {/* ── COACH CARDS ── */}
          {mode==="COACH"&&isPro&&(
            <div style={{marginBottom:14}}>
              {showMorningPlan&&<CoachCard type="morning_plan" context={{name:user?.name,track:user?.track,goal:user?.goal||"maintain",isRestDay,targets}} color="#A78BFA" autoLoad/>}
              {showEveningRecap&&<CoachCard type="evening_recap" context={{calories:totals.calories,protein:totals.protein,targets,track:user?.track}} color="#A78BFA" autoLoad/>}
              {lowProtein&&<CoachCard type="low_protein" context={{protein:totals.protein,targets,track:user?.track,timeOfDay}} color="#F87171" autoLoad/>}
              <CoachCard type="snack_idea" context={{track:user?.track,remaining,timeOfDay}} color="#A78BFA"/>
            </div>
          )}

          {/* Notification prompt — Coach mode */}
          {mode==="COACH"&&isPro&&notifPerm==="default"&&(
            <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.25)",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#A78BFA",marginBottom:4}}>🔔 Enable reminders?</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.5,marginBottom:10}}>Get a morning nutrition plan and evening recap — as browser notifications.</div>
              <button onClick={enableNotifications} style={{padding:"9px 18px",borderRadius:10,border:"none",background:"#A78BFA",color:BG,fontFamily:FD,fontSize:15,fontWeight:800,cursor:"pointer",letterSpacing:"0.06em"}}>
                ENABLE REMINDERS
              </button>
            </div>
          )}

          {/* Coach upsell — removed, Coach is free */}

          {/* Targets summary — TRACKER+ */}
          {mode!=="LOGGER"&&targets&&(
            <div style={{padding:"14px 16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:16}}>
              <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
                DAILY TARGETS · {user?.track} · {isRestDay?"REST DAY":"TRAINING DAY"}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center"}}>
                {[{l:"Calories",v:targets.calories,c:COLOR},{l:"Protein",v:targets.protein,c:"#F87171"},{l:"Carbs",v:targets.carbs,c:"#60A5FA"},{l:"Fat",v:targets.fat,c:"#FB923C"}].map(t=>(
                  <div key={t.l}>
                    <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:t.c,lineHeight:1}}>{t.v}</div>
                    <div style={{fontSize:9,color:MUTED,marginTop:3,letterSpacing:"0.06em",textTransform:"uppercase"}}>{t.l}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:8,fontSize:11,color:MUTED}}>{targets.proteinLabel}</div>
            </div>
          )}

          {/* Meal log */}
          {grouped.length>0?(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>MEAL LOG</div>
              {grouped.map(meal=>(
                <div key={meal.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700}}>{meal.icon} {meal.label}</span>
                    <span style={{fontFamily:FD,fontSize:14,fontWeight:800,color:GOLD}}>{meal.total} kcal</span>
                  </div>
                  {meal.items.map((entry,i)=>(
                    <div key={i} style={{padding:"10px 12px",borderRadius:11,background:SURFACE,border:`1px solid ${BORDER}`,marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,lineHeight:1.4}}>{entry.items?.map(f=>f.name).join(", ")}</div>
                        {mode!=="LOGGER"&&<div style={{fontSize:11,color:MUTED,marginTop:2}}>P:{entry.totalProtein}g · C:{entry.totalCarbs}g · F:{entry.totalFat}g</div>}
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:10}}>
                        <span style={{fontFamily:FD,fontSize:16,fontWeight:800,color:GOLD}}>{entry.totalCalories}</span>
                        <button onClick={()=>{NutritionStore.deleteEntry(entry.id);refresh();}} style={{width:22,height:22,borderRadius:"50%",background:"transparent",border:"none",color:MUTED,cursor:"pointer",fontSize:13}}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ):(
            <div style={{padding:"40px 20px",textAlign:"center",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:20}}>
              <div style={{fontSize:40,marginBottom:12}}>🍽</div>
              <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:MUTED,marginBottom:6}}>NOTHING LOGGED YET</div>
              <div style={{fontSize:13,color:MUTED}}>Tap + LOG or use the mic button to add your first meal.</div>
            </div>
          )}
        </div>
      )}

      {/* Coach Chat — Coach mode */}
      {mode==="COACH"&&isPro&&(
        <CoachChat user={user} targets={targets}/>
      )}

      {/* ── WEEK VIEW ── */}
      {view==="week"&&(
        <div style={{animation:"fadeIn 0.2s ease",marginBottom:20}}>
          {(()=>{
            const logged = weekData.filter(d=>d.entries.length>0);
            if (!logged.length) return (
              <div style={{padding:"32px",textAlign:"center",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:14,color:MUTED,fontSize:13}}>
                Log meals for a few days to see weekly trends.
              </div>
            );
            const avgCal  = Math.round(logged.reduce((s,d)=>s+d.totals.calories,0)/logged.length);
            const avgProt = Math.round(logged.reduce((s,d)=>s+d.totals.protein,0)/logged.length);
            return (
              <>
                {/* Averages */}
                <div style={{padding:"16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:12}}>
                  <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>AVERAGES · {logged.length} DAYS LOGGED</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,textAlign:"center"}}>
                    <div>
                      <div style={{fontFamily:FD,fontSize:32,fontWeight:800,color:targets&&avgCal>targets.calories*1.1?"#F87171":targets&&avgCal<targets.calories*0.8?"#FB923C":COLOR}}>{avgCal}</div>
                      <div style={{fontSize:10,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em"}}>Avg kcal/day</div>
                      {targets&&<div style={{fontSize:10,color:MUTED,marginTop:2}}>target {targets.calories}</div>}
                    </div>
                    {mode!=="LOGGER"&&targets&&(
                      <div>
                        <div style={{fontFamily:FD,fontSize:32,fontWeight:800,color:avgProt>=targets.protein*0.9?"#34D399":"#F87171"}}>{avgProt}g</div>
                        <div style={{fontSize:10,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em"}}>Avg protein/day</div>
                        <div style={{fontSize:10,color:MUTED,marginTop:2}}>target {targets.protein}g</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar chart */}
                <div style={{padding:"16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:12}}>
                  <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>CALORIES THIS WEEK</div>
                  <div style={{display:"flex",gap:6,alignItems:"flex-end",height:80}}>
                    {weekData.map((d,i)=>{
                      const pct=targets?.calories?Math.min(1,d.totals.calories/targets.calories):d.totals.calories/2500;
                      const over=targets&&d.totals.calories>targets.calories;
                      return (
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <div style={{width:"100%",height:64,display:"flex",alignItems:"flex-end"}}>
                            <div style={{width:"100%",height:`${Math.max(2,pct*100)}%`,borderRadius:"4px 4px 0 0",
                              background:over?"#F87171":d.entries.length?COLOR:FAINT,transition:"height 0.5s ease"}}/>
                          </div>
                          <div style={{fontSize:9,color:MUTED,fontWeight:d.label==="Today"?700:400}}>{d.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  {targets&&<div style={{fontSize:10,color:MUTED,marginTop:8,textAlign:"right"}}>Target: {targets.calories} kcal/day</div>}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── MODE SETTINGS SHEET ── */}
      {showSettings&&(
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(6,8,12,0.92)",display:"flex",alignItems:"flex-end"}}>
          <div style={{width:"100%",maxWidth:500,margin:"0 auto",background:SURFACE,borderRadius:"24px 24px 0 0",
            border:`1px solid ${BORDER2}`,borderBottom:"none",padding:"22px 22px 44px",maxHeight:"88vh",overflowY:"auto"}}>
            <div style={{width:36,height:4,borderRadius:2,background:BORDER2,margin:"0 auto 20px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:FD,fontSize:24,fontWeight:800,letterSpacing:"0.04em"}}>NUTRITION MODE</div>
              <button onClick={()=>setShowSettings(false)} style={{padding:"6px 12px",borderRadius:8,background:FAINT,border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13}}>Done</button>
            </div>

            {Object.values(NUTRITION_MODES).map(m=>(
              <button key={m.id} onClick={()=>{
                if(m.pro && !isPro) { NutritionStore.setProStatus(true); setIsPro(true); }
                NutritionStore.setNutritionMode(m.id); setMode(m.id); setShowSettings(false);
              }} style={{
                width:"100%",padding:"16px 18px",borderRadius:16,marginBottom:10,
                border:`2px solid ${mode===m.id?m.color:BORDER2}`,
                background:mode===m.id?`${m.color}08`:SURFACE,
                cursor:"pointer",
                textAlign:"left",transition:"all 0.15s"
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontFamily:FD,fontSize:19,fontWeight:800,color:mode===m.id?m.color:TEXT}}>{m.icon} {m.name}</span>
                  {mode===m.id&&<span style={{fontSize:12,color:m.color,fontWeight:700}}>✓ Active</span>}
                </div>
                <div style={{fontSize:12,color:MUTED,lineHeight:1.5}}>{m.desc}</div>
              </button>
            ))}

            {/* Coach frequency (only if Coach + Pro active) */}
            {mode==="COACH"&&isPro&&(
              <div style={{marginTop:16}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>COACHING FREQUENCY</div>
                {Object.values(COACH_FREQUENCIES).map(f=>(
                  <button key={f.id} onClick={()=>{ NutritionStore.setCoachFreq(f.id); setCoachFreq(f.id); }} style={{
                    width:"100%",padding:"12px 16px",borderRadius:12,marginBottom:8,
                    border:`1.5px solid ${coachFreq===f.id?"#A78BFA":BORDER2}`,
                    background:coachFreq===f.id?"rgba(167,139,250,0.08)":SURFACE,
                    cursor:"pointer",textAlign:"left",transition:"all 0.15s"
                  }}>
                    <div style={{fontSize:13,fontWeight:700,color:coachFreq===f.id?"#A78BFA":TEXT}}>{f.label}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>{f.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal&&(
        <FoodLogModal user={user} targets={targets}
          onSave={()=>{ refresh(); setShowModal(false); }}
          onClose={()=>setShowModal(false)}/>
      )}
    </div>
  );
}

// ─── POST-WORKOUT NUTRITION PROMPT ───────────────────────────────────────────
export function PostWorkoutNutritionPrompt({ user, targets, onLog, onDismiss }) {
  const COLOR = TRACKS_COLOR[user?.track]||GOLD;
  const todayTotals = NutritionStore.getDayTotals();
  const proteinGap  = targets ? Math.max(0,targets.protein-todayTotals.protein) : 0;
  const calGap      = targets ? Math.max(0,targets.calories-todayTotals.calories) : 0;
  return (
    <div style={{padding:"16px 18px",borderRadius:16,background:`${COLOR}0C`,border:`1.5px solid ${COLOR}25`,fontFamily:FB,marginBottom:16}}>
      <div style={{fontSize:10,color:COLOR,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>💪 POST-WORKOUT NUTRITION</div>
      <div style={{fontSize:13,color:TEXT,fontWeight:600,marginBottom:4}}>Did you eat after your session?</div>
      <div style={{fontSize:12,color:MUTED,lineHeight:1.5,marginBottom:14}}>
        {proteinGap>0?`~${proteinGap}g protein still needed today. A post-workout meal now accelerates recovery.`
          :calGap>0?`${calGap} kcal remaining — time to refuel.`
          :"You've hit your targets. Great work today."}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button onClick={onLog} style={{padding:"12px",borderRadius:11,border:"none",background:COLOR,color:BG,cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.06em",boxShadow:`0 4px 12px ${COLOR}30`}}>LOG MEAL</button>
        <button onClick={onDismiss} style={{padding:"12px",borderRadius:11,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13}}>Skip</button>
      </div>
    </div>
  );
}

// ─── COACH CHAT ───────────────────────────────────────────────────────────────
const CHAT_KEY = "ff_coach_chat";
function loadChatHistory() { try { return JSON.parse(localStorage.getItem(CHAT_KEY)||"[]"); } catch { return []; } }
function saveChatHistory(msgs) { try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-40))); } catch {} }

export function CoachChat({ user, targets, sessionContext=null }) {
  const COLOR = "#A78BFA";
  const todayTotals = NutritionStore.getDayTotals();
  const [msgs, setMsgs] = useState(()=>loadChatHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const systemContext = `You are FitForge's personal nutrition coach. Be concise, direct, and practical.
Athlete: ${user?.name||"Athlete"} | Track: ${user?.track||"FORGE"} | Goal: ${user?.goal||"maintain"}
Today's nutrition: ${todayTotals.calories}kcal, ${todayTotals.protein}g protein logged.
${targets ? `Targets: ${targets.calories}kcal / ${targets.protein}g protein.` : ""}
${sessionContext ? `Just completed: ${sessionContext.track} session (~${sessionContext.duration||"45 min"}).` : ""}
Answer in under 80 words unless a longer answer is clearly needed. Be specific, not generic.`;

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user", text: input.trim(), ts: Date.now() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    saveChatHistory(newMsgs);
    setInput("");
    setSending(true);
    try {
      const reply = await getCoachSuggestion("chat", {
        message: `${systemContext}\n\nUser: ${userMsg.text}`,
      });
      const aiMsg = { role: "coach", text: reply, ts: Date.now() };
      const final = [...newMsgs, aiMsg];
      setMsgs(final);
      saveChatHistory(final);
    } catch {
      const errMsg = { role: "coach", text: "Couldn't reach the coach right now. Try again in a moment.", ts: Date.now() };
      const final = [...newMsgs, errMsg];
      setMsgs(final);
      saveChatHistory(final);
    } finally { setSending(false); }
  };

  const clearChat = () => { saveChatHistory([]); setMsgs([]); };

  return (
    <div style={{marginBottom:16,borderRadius:16,background:SURFACE,border:`1px solid ${open ? COLOR+"40" : BORDER2}`,overflow:"hidden",transition:"border-color 0.2s",fontFamily:FB}}>
      {/* Header */}
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        <div style={{width:36,height:36,borderRadius:10,background:`${COLOR}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🧠</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Nutrition Coach</div>
          <div style={{fontSize:11,color:MUTED}}>{msgs.length>0?`${msgs.length} messages`:"Ask anything about food, timing, macros…"}</div>
        </div>
        <div style={{fontSize:12,color:open?COLOR:MUTED,transition:"color 0.2s"}}>{open?"▲":"▼"}</div>
      </button>

      {/* Chat body */}
      {open&&(
        <div style={{borderTop:`1px solid ${BORDER}`}}>
          {/* Messages */}
          <div style={{maxHeight:340,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {msgs.length===0&&(
              <div style={{padding:"24px 0",textAlign:"center",color:MUTED,fontSize:13}}>
                Ask about meal timing, what to eat around workouts, hitting your protein, anything.
              </div>
            )}
            {msgs.map((m,i)=>{
              const isUser = m.role==="user";
              return (
                <div key={i} style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start"}}>
                  <div style={{
                    maxWidth:"82%",padding:"10px 14px",borderRadius:isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",
                    background:isUser?COLOR:`${COLOR}12`,
                    color:isUser?BG:TEXT,fontSize:13,lineHeight:1.6,
                    border:isUser?"none":`1px solid ${COLOR}25`,
                  }}>{m.text}</div>
                </div>
              );
            })}
            {sending&&(
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{padding:"10px 14px",borderRadius:"14px 14px 14px 4px",background:`${COLOR}12`,border:`1px solid ${COLOR}25`,color:MUTED,fontSize:13}}>Thinking…</div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 14px 14px",display:"flex",gap:8,alignItems:"flex-end"}}>
            <textarea
              value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
              placeholder="Ask your coach…"
              rows={1}
              style={{flex:1,background:FAINT,border:`1px solid ${BORDER2}`,borderRadius:10,padding:"10px 12px",color:TEXT,fontFamily:FB,fontSize:13,resize:"none",outline:"none",lineHeight:1.5,maxHeight:80,overflowY:"auto"}}
            />
            <button onClick={send} disabled={!input.trim()||sending} style={{padding:"10px 14px",borderRadius:10,border:"none",background:input.trim()&&!sending?COLOR:FAINT,color:input.trim()&&!sending?BG:MUTED,fontFamily:FD,fontSize:14,fontWeight:800,cursor:input.trim()&&!sending?"pointer":"not-allowed",flexShrink:0,transition:"all 0.15s"}}>↑</button>
          </div>

          {msgs.length>0&&(
            <div style={{padding:"0 14px 10px",textAlign:"right"}}>
              <button onClick={clearChat} style={{background:"transparent",border:"none",color:MUTED,fontSize:11,cursor:"pointer"}}>Clear chat</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
