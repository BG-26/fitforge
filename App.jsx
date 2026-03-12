import { useState, useEffect, useRef } from "react";
import { FoodTrackerTab, FloatingMicButton, calcTDEE, calcTargets, PostWorkoutNutritionPrompt } from "./FoodTracker";
import IntervalTimer from "./IntervalTimer";
import { HealthConnectionsPanel } from "./HealthConnections";
import { ProgramsTab } from "./ProgramLibrary";
import { getTrackingMode, setTrackingMode, saveExerciseLog, saveSession, getExerciseHistory, getAdaptation, getNudge, applyAdaptations, slugify, parseRepsForDisplay, TRACKING_MODES } from "./PerformanceEngine";

// ─── INLINE ENGINE ────────────────────────────────────────────────────────────
const TRACKS = {
  FORGE: { id:"FORGE", name:"FORGE", tagline:"Built. Dense. Powerful.", description:"Strength-first programming. Heavy compound movements, progressive overload, hypertrophy. You leave stronger than you arrived.", icon:"🔩", color:"#F87171", colorDim:"rgba(248,113,113,0.1)", gradient:"linear-gradient(135deg,#F87171,#DC2626)", primaryAxes:["fx_drive","fx_form"], blueprint:["PUSH","PULL","SQUAT","HINGE","CORE","PUSH"], auditDepth:{fx_drive:5,fx_burst:2,fx_engine:2,fx_range:3,fx_form:4} },
  SURGE: { id:"SURGE", name:"SURGE", tagline:"Explosive. Athletic. Conditioned.", description:"Power-based metabolic programming. Functional movements under fatigue, athletic conditioning, explosive capacity. Built for performance.", icon:"⚡", color:"#F0C060", colorDim:"rgba(240,192,96,0.1)", gradient:"linear-gradient(135deg,#F0C060,#D97706)", primaryAxes:["fx_burst","fx_engine"], blueprint:["METCON","PUSH","SQUAT","PULL","LUNGE","METCON"], auditDepth:{fx_drive:2,fx_burst:5,fx_engine:5,fx_range:2,fx_form:2} },
  FLOW:  { id:"FLOW",  name:"FLOW",  tagline:"Mobile. Fluid. Precise.",      description:"Movement-quality programming. Mobility, motor control, joint health. Builds the body that lasts.", icon:"🌊", color:"#5EEAD4", colorDim:"rgba(94,234,212,0.1)", gradient:"linear-gradient(135deg,#5EEAD4,#0891B2)", primaryAxes:["fx_range","fx_burst"], blueprint:["SQUAT","LUNGE","PULL","CORE","PUSH","METCON"], auditDepth:{fx_drive:2,fx_burst:3,fx_engine:2,fx_range:5,fx_form:3} },
};

const FX_AXES = [
  { id:"fx_drive",  name:"Drive",  icon:"🔩", color:"#F87171", unit:"Strength",  desc:"Raw force output across compound movements" },
  { id:"fx_burst",  name:"Burst",  icon:"⚡", color:"#F0C060", unit:"Power",     desc:"Explosive capacity — power, speed, reactivity" },
  { id:"fx_engine", name:"Engine", icon:"❤️", color:"#60A5FA", unit:"Endurance", desc:"Work capacity — how long and hard you sustain effort" },
  { id:"fx_range",  name:"Range",  icon:"🌊", color:"#5EEAD4", unit:"Mobility",  desc:"Movement quality — flexibility and joint health" },
  { id:"fx_form",   name:"Form",   icon:"✦",  color:"#E879F9", unit:"Aesthetic", desc:"Body composition and movement control" },
];

const AUDIT_QUESTIONS = {
  fx_drive:[
    {id:"d1",text:"Unbroken push-ups in one set?",opts:["0–5","6–15","16–25","25+"],scores:[10,30,60,85]},
    {id:"d2",text:"Best press relative to bodyweight?",opts:["Haven't tested","< 0.5× BW","0.5–1× BW","1× BW+"],scores:[10,25,55,85]},
    {id:"d3",text:"Strict pull-ups / chin-ups?",opts:["0","1–3","4–8","9+"],scores:[5,30,60,90]},
    {id:"d4",text:"Squat your bodyweight for 5 reps?",opts:["No","Not sure","Yes, with effort","Yes, comfortably"],scores:[10,30,60,90]},
    {id:"d5",text:"Overall strength level?",opts:["Very new","Building base","Solid, progressing","Experienced lifter"],scores:[10,30,65,90]},
  ],
  fx_burst:[
    {id:"b1",text:"Box jump from standstill?",opts:["No","Low only","Comfortable","Explosive, high box"],scores:[10,30,60,90]},
    {id:"b2",text:"Jump squats — how do you feel?",opts:["Never done","Awkward","Comfortable","Strong and explosive"],scores:[10,25,60,88]},
    {id:"b3",text:"Sprint power output?",opts:["I don't sprint","Slow / avoid","Decent speed","Fast and explosive"],scores:[10,20,55,88]},
    {id:"b4",text:"Kettlebell swing hip hinge?",opts:["Never done","Just learning","Comfortable","Powerful, consistent"],scores:[10,25,60,90]},
    {id:"b5",text:"Transitions between circuit moves?",opts:["Need long breaks","Some rest","Fairly quick","Minimal rest"],scores:[10,30,65,90]},
  ],
  fx_engine:[
    {id:"e1",text:"Jog 20 minutes without stopping?",opts:["No","Maybe 5–10 min","Yes but hard","Yes, comfortably"],scores:[5,25,60,90]},
    {id:"e2",text:"4 flights of stairs — how do you feel?",opts:["Very winded","Noticeably breathless","Slightly winded","Easy"],scores:[10,30,65,90]},
    {id:"e3",text:"Heart rate recovery after a hard set?",opts:["> 3 minutes","2–3 minutes","1–2 minutes","Under 1 minute"],scores:[10,30,65,90]},
    {id:"e4",text:"Cardio / conditioning days per week?",opts:["0","1","2–3","4+"],scores:[10,25,60,88]},
    {id:"e5",text:"During a 45-min circuit, you:",opts:["Struggle to finish","Modify a lot","Keep up, some rest","Complete it fully"],scores:[10,25,60,90]},
  ],
  fx_range:[
    {id:"r1",text:"Standing toe touch — reach?",opts:["Past knees only","Mid-shin","Ankles","Palms flat"],scores:[10,30,65,90]},
    {id:"r2",text:"Overhead squat position?",opts:["Can't do it","Arms drift","Almost vertical","Fully vertical, easy"],scores:[10,30,60,88]},
    {id:"r3",text:"Hip / back tightness from sitting?",opts:["Constant","Often","Occasionally","Rarely / never"],scores:[10,25,60,90]},
    {id:"r4",text:"Deep squat, heels down, 30 seconds?",opts:["No","On toes only","With effort","Yes, comfortably"],scores:[10,25,55,88]},
    {id:"r5",text:"Arms straight overhead?",opts:["Arms forward/bent","Slight flare","Almost vertical","Fully vertical"],scores:[10,30,65,90]},
  ],
  fx_form:[
    {id:"f1",text:"Body composition focus?",opts:["Not focused","Some interest","Actively working","Dialled in, tracking"],scores:[20,40,65,90]},
    {id:"f2",text:"Strict plank — how long clean?",opts:["< 20 seconds","20–40 seconds","40–60 seconds","60+ seconds"],scores:[10,30,60,88]},
    {id:"f3",text:"Single-leg balance, eyes closed, 10s?",opts:["Can't do it","Lots of wobble","Some wobble","Solid, controlled"],scores:[10,30,60,90]},
    {id:"f4",text:"Muscle activation awareness?",opts:["Not really","Sometimes","Usually","Always — strong MMC"],scores:[10,30,60,90]},
  ],
};

const COMMON_LIMITERS = [
  {id:"lower_back",label:"Lower Back"},{id:"knee",label:"Knee"},{id:"shoulder",label:"Shoulder"},
  {id:"hip",label:"Hip"},{id:"wrist",label:"Wrist"},{id:"elbow",label:"Elbow"},
  {id:"ankle",label:"Ankle"},{id:"neck",label:"Neck"},
];

const LOADOUT = [
  // Free weights
  {id:"dumbbells_fixed",    label:"Fixed Dumbbells",     icon:"🏋️", category:"weights"},
  {id:"dumbbells_adjustable",label:"Adjustable Dumbbells",icon:"🔧", category:"weights"},
  {id:"barbell",            label:"Barbell",              icon:"🏗️", category:"weights"},
  {id:"curl_bar",           label:"EZ Curl Bar",          icon:"〰️", category:"weights"},
  {id:"kettlebell",         label:"Kettlebell",           icon:"⚙️", category:"weights"},
  {id:"resistance_bands",   label:"Resistance Bands",     icon:"🪢", category:"weights"},
  {id:"weighted_vest",      label:"Weighted Vest",        icon:"🦺", category:"weights"},
  {id:"sandbag",            label:"Sandbag",              icon:"🏖️", category:"weights"},
  // Machines & racks
  {id:"squat_rack",         label:"Squat Rack",           icon:"🏰", category:"machines"},
  {id:"bench",              label:"Bench",                icon:"🪑", category:"machines"},
  {id:"cable_machine",      label:"Cable Machine",        icon:"🔄", category:"machines"},
  {id:"preacher_curl",      label:"Preacher Curl",        icon:"💪", category:"machines"},
  {id:"lat_pulldown",       label:"Lat Pulldown",         icon:"⬇️", category:"machines"},
  {id:"leg_press",          label:"Leg Press",            icon:"🦵", category:"machines"},
  {id:"smith_machine",      label:"Smith Machine",        icon:"🔩", category:"machines"},
  // Bodyweight & gymnastics
  {id:"pullup_bar",         label:"Pull-up Bar",          icon:"🔩", category:"bodyweight"},
  {id:"rings",              label:"Gymnastic Rings",      icon:"⭕", category:"bodyweight"},
  {id:"plyo_box",           label:"Plyo Box",             icon:"📦", category:"bodyweight"},
  {id:"parallettes",        label:"Parallettes",          icon:"∥",  category:"bodyweight"},
  {id:"ab_wheel",           label:"Ab Wheel",             icon:"🔵", category:"bodyweight"},
  // Cardio equipment
  {id:"rowing_machine",     label:"Rowing Machine",       icon:"🚣", category:"cardio"},
  {id:"assault_bike",       label:"Assault Bike",         icon:"💨", category:"cardio"},
  {id:"stationary_bike",    label:"Stationary Bike",      icon:"🚴", category:"cardio"},
  {id:"bike_trainer",       label:"Bike + Trainer",       icon:"🚲", category:"cardio"},
  {id:"treadmill",          label:"Treadmill",            icon:"🏃", category:"cardio"},
  {id:"ski_erg",            label:"Ski Erg",              icon:"⛷️", category:"cardio"},
  {id:"jump_rope",          label:"Jump Rope",            icon:"⤵️", category:"cardio"},
  // Combat & functional
  {id:"heavy_bag",          label:"Heavy Bag",            icon:"🥊", category:"functional"},
  {id:"battle_ropes",       label:"Battle Ropes",         icon:"〰️", category:"functional"},
  {id:"sled",               label:"Sled / Push Sled",     icon:"➡️", category:"functional"},
  {id:"trx",                label:"TRX / Suspension",     icon:"🔗", category:"functional"},
  {id:"foam_roller",        label:"Foam Roller",          icon:"🫀", category:"functional"},
];

const EXERCISES = [
  {id:"push-pushup",name:"Push-up",slot:"PUSH",equipment:[],limitedBy:["wrist","shoulder"],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3–4",reps:"10–20",cue:"Straight line head to heel, elbows 45°"},
  {id:"push-db-bench",name:"DB Bench Press",slot:"PUSH",equipment:["dumbbells_fixed"],limitedBy:["shoulder"],tier:4,tracks:["FORGE","SURGE"],sets:"3–4",reps:"8–12",cue:"Full stretch at bottom, squeeze at top"},
  {id:"push-bb-bench",name:"Barbell Bench Press",slot:"PUSH",equipment:["barbell","bench"],limitedBy:["shoulder","wrist"],tier:6,tracks:["FORGE"],sets:"3–5",reps:"3–8",cue:"Bar over mid-chest, drive feet into floor"},
  {id:"push-incline-pushup",name:"Incline Push-up",slot:"PUSH",equipment:[],limitedBy:[],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"12–15",cue:"Hands elevated, reduces load"},
  {id:"push-pike-pushup",name:"Pike Push-up",slot:"PUSH",equipment:[],limitedBy:["shoulder"],tier:5,tracks:["FORGE","FLOW"],sets:"3",reps:"6–10",cue:"Hips high in V, lower head between hands"},
  {id:"push-kb-press",name:"KB Press",slot:"PUSH",equipment:["kettlebell"],limitedBy:["shoulder"],tier:4,tracks:["FORGE","SURGE"],sets:"3",reps:"5–8/side",cue:"Rack position, press to full lockout"},
  {id:"push-db-ohp",name:"DB Shoulder Press",slot:"PUSH",equipment:["dumbbells_fixed"],limitedBy:["shoulder"],tier:4,tracks:["FORGE","SURGE"],sets:"3–4",reps:"8–12",cue:"Full overhead lockout, brace core"},
  {id:"push-band-press",name:"Band Chest Press",slot:"PUSH",equipment:["resistance_bands"],limitedBy:[],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"12–15",cue:"Anchor at chest, press straight out"},
  {id:"push-dips",name:"Dips",slot:"PUSH",equipment:["bench"],limitedBy:["shoulder","wrist"],tier:5,tracks:["FORGE","SURGE"],sets:"3",reps:"8–15",cue:"Lean forward for chest, upright for triceps"},
  {id:"push-shoulder-cars",name:"Shoulder CARs",slot:"PUSH",equipment:[],limitedBy:[],tier:2,tracks:["FLOW"],sets:"3",reps:"3–5/side",cue:"Max-tension end-range circles, slow"},
  {id:"pull-pullup",name:"Pull-up",slot:"PULL",equipment:["pullup_bar"],limitedBy:["shoulder"],tier:6,tracks:["FORGE","SURGE"],sets:"3–5",reps:"3–8",cue:"Dead hang, pull elbows to hips"},
  {id:"pull-chinup",name:"Chin-up",slot:"PULL",equipment:["pullup_bar"],limitedBy:["shoulder","elbow"],tier:5,tracks:["FORGE","SURGE"],sets:"3–4",reps:"4–10",cue:"Underhand grip, full range"},
  {id:"pull-band-row",name:"Band Row",slot:"PULL",equipment:["resistance_bands"],limitedBy:[],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"15–20",cue:"Pull elbows back, squeeze"},
  {id:"pull-inverted-row",name:"Inverted Row",slot:"PULL",equipment:["pullup_bar"],limitedBy:["shoulder"],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"8–12",cue:"Body straight, chest to bar"},
  {id:"pull-db-row",name:"DB Row",slot:"PULL",equipment:["dumbbells_fixed","bench"],limitedBy:["lower_back"],tier:4,tracks:["FORGE","SURGE"],sets:"3–4",reps:"8–12/side",cue:"Elbow past hip, control descent"},
  {id:"pull-kb-swing",name:"KB Swing",slot:"PULL",equipment:["kettlebell"],limitedBy:["lower_back"],tier:5,tracks:["SURGE","FLOW"],sets:"4–5",reps:"12–20",cue:"Hip hinge drives, float to shoulder"},
  {id:"pull-face-pull",name:"Face Pull",slot:"PULL",equipment:["resistance_bands"],limitedBy:[],tier:3,tracks:["FORGE","FLOW"],sets:"3",reps:"15–20",cue:"Pull to forehead, external rotation"},
  {id:"pull-bb-row",name:"Barbell Row",slot:"PULL",equipment:["barbell"],limitedBy:["lower_back"],tier:7,tracks:["FORGE"],sets:"3–5",reps:"4–8",cue:"45° hinge, drag bar to lower chest"},
  {id:"squat-bw",name:"Bodyweight Squat",slot:"SQUAT",equipment:[],limitedBy:["knee","ankle"],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"15–25",cue:"Knees track toes, below parallel"},
  {id:"squat-goblet",name:"Goblet Squat",slot:"SQUAT",equipment:["kettlebell"],limitedBy:["knee","ankle"],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3–4",reps:"10–15",cue:"Weight at chest, elbows inside knees"},
  {id:"squat-back-squat",name:"Back Squat",slot:"SQUAT",equipment:["barbell","squat_rack"],limitedBy:["knee","lower_back","ankle"],tier:8,tracks:["FORGE"],sets:"3–5",reps:"3–8",cue:"Brace core, drive knees out"},
  {id:"squat-front-squat",name:"Front Squat",slot:"SQUAT",equipment:["barbell"],limitedBy:["knee","wrist","ankle"],tier:7,tracks:["FORGE","SURGE"],sets:"3–5",reps:"4–8",cue:"Elbows high, vertical torso"},
  {id:"squat-jump",name:"Jump Squat",slot:"SQUAT",equipment:[],limitedBy:["knee","ankle"],tier:5,tracks:["SURGE"],sets:"4",reps:"8–10",cue:"Quarter squat, explosive jump, soft land"},
  {id:"squat-pause",name:"Pause Squat",slot:"SQUAT",equipment:[],limitedBy:["knee","ankle"],tier:4,tracks:["FORGE","FLOW"],sets:"3",reps:"6–10",cue:"3-second pause at bottom, stay braced"},
  {id:"squat-90-90",name:"90/90 Hip Stretch",slot:"SQUAT",equipment:[],limitedBy:[],tier:2,tracks:["FLOW"],sets:"2",reps:"60–90s/side",cue:"Sit tall, lean over front shin"},
  {id:"squat-seated-leg-ext",name:"Seated Leg Extension",slot:"SQUAT",equipment:[],limitedBy:[],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"15–20",cue:"Seated on bench, extend knee to full lockout, controlled lower"},
  {id:"squat-wall-sit",name:"Wall Sit",slot:"SQUAT",equipment:[],limitedBy:[],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"30–60s",cue:"Back flat on wall, thighs parallel, knees over ankles minimal"},
  {id:"lunge-seated-march",name:"Seated March",slot:"LUNGE",equipment:[],limitedBy:[],tier:1,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"20–30 total",cue:"Seated, alternate lifting knees, core braced"},
  {id:"lunge-standing-abduction",name:"Standing Hip Abduction",slot:"LUNGE",equipment:["resistance_bands"],limitedBy:[],tier:2,tracks:["FORGE","FLOW"],sets:"3",reps:"15–20/side",cue:"Band at ankles, shift weight, lift leg laterally — minimal ankle stress"},
  {id:"squat-deep-hold",name:"Deep Squat Hold",slot:"SQUAT",equipment:[],limitedBy:["knee","ankle"],tier:3,tracks:["FLOW"],sets:"3",reps:"30–60s",cue:"Heels down, chest up, breathe"},
  {id:"hinge-rdl-db",name:"DB RDL",slot:"HINGE",equipment:["dumbbells_fixed"],limitedBy:["lower_back"],tier:4,tracks:["FORGE","SURGE"],sets:"3–4",reps:"8–12",cue:"Push hips back, weights close to legs"},
  {id:"hinge-rdl-bb",name:"Barbell RDL",slot:"HINGE",equipment:["barbell"],limitedBy:["lower_back"],tier:6,tracks:["FORGE"],sets:"3–4",reps:"6–10",cue:"Hip hinge, bar stays close, neutral spine"},
  {id:"hinge-deadlift",name:"Deadlift",slot:"HINGE",equipment:["barbell"],limitedBy:["lower_back"],tier:8,tracks:["FORGE"],sets:"3–5",reps:"2–6",cue:"Push floor away, lock out with glutes"},
  {id:"hinge-glute-bridge",name:"Glute Bridge",slot:"HINGE",equipment:[],limitedBy:[],tier:2,tracks:["FORGE","FLOW"],sets:"3",reps:"15–20",cue:"Drive hips to ceiling, squeeze at top"},
  {id:"hinge-kb-swing",name:"KB Swing",slot:"HINGE",equipment:["kettlebell"],limitedBy:["lower_back"],tier:5,tracks:["SURGE","FLOW"],sets:"4–5",reps:"12–20",cue:"Hip hinge drives power, float to shoulder"},
  {id:"hinge-good-morning",name:"Good Morning",slot:"HINGE",equipment:[],limitedBy:["lower_back"],tier:2,tracks:["FORGE","FLOW"],sets:"3",reps:"12–15",cue:"Soft knee, hinge from hips, stretch hamstrings"},
  {id:"hinge-hip-thrust",name:"Hip Thrust",slot:"HINGE",equipment:["bench"],limitedBy:[],tier:5,tracks:["FORGE"],sets:"3–4",reps:"10–15",cue:"Upper back on bench, squeeze glutes at top"},
  {id:"lunge-reverse",name:"Reverse Lunge",slot:"LUNGE",equipment:[],limitedBy:["knee","ankle"],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"10–12/side",cue:"Step back, lower rear knee gently"},
  {id:"lunge-split-squat",name:"Bulgarian Split Squat",slot:"LUNGE",equipment:["bench"],limitedBy:["knee","hip"],tier:6,tracks:["FORGE","SURGE"],sets:"3",reps:"8–12/side",cue:"Rear foot elevated, front shin vertical"},
  {id:"lunge-lateral",name:"Lateral Lunge",slot:"LUNGE",equipment:[],limitedBy:["knee","hip"],tier:3,tracks:["FLOW","SURGE"],sets:"3",reps:"10–12/side",cue:"Wide step, push hips back"},
  {id:"lunge-walking",name:"Walking Lunge",slot:"LUNGE",equipment:[],limitedBy:["knee","ankle"],tier:3,tracks:["FORGE","SURGE"],sets:"3",reps:"10–14/side",cue:"Long stride, drive off front foot"},
  {id:"lunge-step-up",name:"Step-Up",slot:"LUNGE",equipment:["bench"],limitedBy:["knee","ankle"],tier:3,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"10–12/side",cue:"Drive through heel on box"},
  {id:"lunge-cossack",name:"Cossack Squat",slot:"LUNGE",equipment:[],limitedBy:["knee","hip"],tier:6,tracks:["FLOW"],sets:"3",reps:"6–8/side",cue:"Wide stance, shift weight, opposite leg straight"},
  {id:"lunge-worlds-greatest",name:"World's Greatest Stretch",slot:"LUNGE",equipment:[],limitedBy:[],tier:3,tracks:["FLOW"],sets:"2",reps:"5/side",cue:"Lunge → rotate → reach — move slowly"},
  {id:"core-plank",name:"Plank",slot:"CORE",equipment:[],limitedBy:["wrist","shoulder"],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"30–60s",cue:"Squeeze glutes and quads, breathe"},
  {id:"core-dead-bug",name:"Dead Bug",slot:"CORE",equipment:[],limitedBy:[],tier:2,tracks:["FORGE","SURGE","FLOW"],sets:"3",reps:"8–10/side",cue:"Lower back pressed into floor throughout"},
  {id:"core-hollow-hold",name:"Hollow Hold",slot:"CORE",equipment:[],limitedBy:[],tier:4,tracks:["FORGE","FLOW"],sets:"3",reps:"20–45s",cue:"Lower back flat, legs low, arms overhead"},
  {id:"core-hanging-knee",name:"Hanging Knee Raise",slot:"CORE",equipment:["pullup_bar"],limitedBy:["shoulder"],tier:4,tracks:["FORGE","SURGE"],sets:"3",reps:"10–15",cue:"Dead hang, pull knees to chest, no swing"},
  {id:"core-pallof",name:"Pallof Press",slot:"CORE",equipment:["resistance_bands"],limitedBy:[],tier:4,tracks:["FORGE","FLOW"],sets:"3",reps:"10–12/side",cue:"Resist rotation — don't let band pull you"},
  {id:"core-bird-dog",name:"Bird Dog",slot:"CORE",equipment:[],limitedBy:[],tier:2,tracks:["FLOW","FORGE"],sets:"3",reps:"8–12/side",cue:"Opposite arm and leg, hips level"},
  {id:"core-side-plank",name:"Side Plank",slot:"CORE",equipment:[],limitedBy:["wrist","shoulder"],tier:3,tracks:["FORGE","FLOW"],sets:"3",reps:"30–45s/side",cue:"Hip stacked, body straight"},
  {id:"core-thoracic-rot",name:"Thoracic Rotation",slot:"CORE",equipment:[],limitedBy:[],tier:2,tracks:["FLOW"],sets:"2",reps:"10–15/side",cue:"Side-lying, upper body rotates, lower stays"},
  {id:"metcon-burpee",name:"Burpee",slot:"METCON",equipment:[],limitedBy:["wrist","shoulder","knee"],tier:5,tracks:["SURGE"],sets:"3–5",reps:"8–15",cue:"Chest to floor, explosive jump"},
  {id:"metcon-mountain-climber",name:"Mountain Climber",slot:"METCON",equipment:[],limitedBy:["wrist","shoulder"],tier:3,tracks:["SURGE","FLOW"],sets:"3–4",reps:"30–60s",cue:"Plank position, drive knees, hips level"},
  {id:"metcon-box-jump",name:"Box Jump",slot:"METCON",equipment:["plyo_box"],limitedBy:["knee","ankle"],tier:5,tracks:["SURGE"],sets:"4–5",reps:"6–10",cue:"Land soft in partial squat, step down"},
  {id:"metcon-kb-swing",name:"KB Swing Metcon",slot:"METCON",equipment:["kettlebell"],limitedBy:["lower_back"],tier:5,tracks:["SURGE"],sets:"5",reps:"15–25",cue:"Explosive hip drive, 20+ unbroken"},
  {id:"metcon-jump-rope",name:"Jump Rope",slot:"METCON",equipment:["jump_rope"],limitedBy:["knee","ankle"],tier:3,tracks:["SURGE"],sets:"5",reps:"30–60s",cue:"Light on feet, wrists drive the rope"},
  {id:"metcon-squat-thrust",name:"Squat Thrust",slot:"METCON",equipment:[],limitedBy:["wrist"],tier:3,tracks:["SURGE","FLOW"],sets:"4",reps:"10–15",cue:"Hands down, jump back, jump in, stand"},
  {id:"metcon-battle-ropes",name:"Battle Ropes",slot:"METCON",equipment:["battle_ropes"],limitedBy:["shoulder"],tier:4,tracks:["SURGE"],sets:"5",reps:"30–45s",cue:"Drive from hips, full-amplitude waves"},
  {id:"metcon-rowing",name:"Row Intervals",slot:"METCON",equipment:["rowing_machine"],limitedBy:["lower_back"],tier:5,tracks:["SURGE"],sets:"6–10",reps:"250m",cue:"Legs → hips → arms on the drive"},
  {id:"metcon-assault-bike",name:"Assault Bike Sprint",slot:"METCON",equipment:["assault_bike"],limitedBy:["knee"],tier:6,tracks:["SURGE"],sets:"6–10",reps:"15–30s",cue:"Max effort, arms and legs coordinated"},
  {id:"metcon-bear-crawl",name:"Bear Crawl",slot:"METCON",equipment:[],limitedBy:["wrist","shoulder"],tier:4,tracks:["SURGE","FLOW"],sets:"4",reps:"20m",cue:"Knees 1 inch off floor, opposite arm/leg"},
  {id:"metcon-jumping-jacks",name:"Jumping Jacks",slot:"METCON",equipment:[],limitedBy:["ankle"],tier:1,tracks:["SURGE","FLOW"],sets:"3–5",reps:"30–60s",cue:"Full arm extension, land softly"},
];

const SLOT_COLORS = {PUSH:"#F87171",PULL:"#60A5FA",SQUAT:"#F0C060",HINGE:"#34D399",CORE:"#5EEAD4",LUNGE:"#A78BFA",METCON:"#FB923C"};

// ─── AGE TIER SYSTEM ──────────────────────────────────────────────────────────
// Each tier defines: max Protocol Tier cap, excluded exercise IDs (high-risk for age),
// preferred slots (weighted higher in random selection), and a label + description.
const AGE_TIERS = {
  PRIME:    { id:"PRIME",    label:"Prime",         range:"18–34", icon:"⚡", color:"#34D399", tierCap:10, excludedIds:[], preferLow:false,  desc:"Full library. No age-based restrictions." },
  EXPERIENCED: { id:"EXPERIENCED", label:"Experienced", range:"35–49", icon:"🔷", color:"#60A5FA", tierCap:9,  excludedIds:["squat-back-squat","hinge-deadlift","push-hspu-wall"], preferLow:false, desc:"Joint-aware defaults. Heavy spinal loading deprioritised." },
  MASTERS:  { id:"MASTERS",  label:"Masters",       range:"50–64", icon:"🔶", color:"#F0C060", tierCap:7,  excludedIds:["squat-back-squat","squat-jump","hinge-deadlift","metcon-burpee","metcon-box-jump","push-hspu-wall","lunge-cossack"], preferLow:true, desc:"Impact and compression loads reduced. Mobility and control prioritised." },
  ELITE_MASTERS: { id:"ELITE_MASTERS", label:"Elite Masters", range:"65+", icon:"🔴", color:"#F87171", tierCap:5, excludedIds:["squat-back-squat","squat-front-squat","squat-jump","hinge-deadlift","hinge-rdl-bb","metcon-burpee","metcon-box-jump","metcon-assault-bike","push-hspu-wall","lunge-cossack","lunge-split-squat","pull-bb-row"], preferLow:true, desc:"Low-impact, balance-positive, anti-compression defaults. Full override available." },
};

// Derive age tier from numeric age
function getAgeTier(age) {
  const n = parseInt(age, 10);
  if (isNaN(n) || n < 35) return AGE_TIERS.PRIME;
  if (n < 50) return AGE_TIERS.EXPERIENCED;
  if (n < 65) return AGE_TIERS.MASTERS;
  return AGE_TIERS.ELITE_MASTERS;
}

// ─── INJURY → MOVEMENT EXCLUSION MAP ─────────────────────────────────────────
// When a limiter is active, these exercise IDs are additionally excluded
// (on top of the exercise's own limitedBy array — belt-and-suspenders safety)
const INJURY_EXCLUSION_MAP = {
  ankle: [
    // All squats — deep dorsiflexion required
    "squat-bw","squat-goblet","squat-back-squat","squat-front-squat",
    "squat-jump","squat-pause","squat-deep-hold",
    // All lunges — ankle stability + dorsiflexion
    "lunge-reverse","lunge-walking","lunge-split-squat",
    "lunge-lateral","lunge-cossack","lunge-step-up",
    // High-impact metcon
    "metcon-box-jump","metcon-jump-rope","metcon-burpee",
    "metcon-sprint","metcon-jumping-jacks","metcon-squat-thrust",
    // Hinge movements with ankle load
    "hinge-kb-swing","metcon-kb-swing",
  ],
  knee: [
    "squat-back-squat","squat-front-squat","squat-jump","squat-goblet",
    "lunge-split-squat","lunge-walking","lunge-cossack","lunge-lateral",
    "metcon-box-jump","metcon-burpee","metcon-jump-rope",
  ],
  lower_back: [
    "hinge-deadlift","hinge-rdl-bb","pull-bb-row","squat-back-squat",
    "hinge-good-morning","metcon-rowing","hinge-kb-swing","metcon-kb-swing",
  ],
  shoulder: [
    "push-hspu-wall","push-pike-pushup","push-bb-bench","push-dips",
    "pull-pullup","pull-chinup","core-hanging-knee","metcon-battle-ropes",
    "metcon-bear-crawl","metcon-mountain-climber",
  ],
  wrist: [
    "push-pushup","push-bb-bench","core-plank","core-side-plank",
    "metcon-burpee","metcon-mountain-climber","metcon-bear-crawl",
    "metcon-squat-thrust",
  ],
  hip: [
    "lunge-split-squat","lunge-cossack","lunge-lateral",
    "squat-back-squat","squat-front-squat","flow-pigeon-pose",
  ],
  elbow: ["pull-chinup","push-dips","push-diamond-pushup"],
  neck:  ["push-hspu-wall","squat-back-squat","pull-pullup"],
};

// Build the full exclusion set from limiters + age tier (unless overridden)
function buildExclusionSet(limiters, ageTier, ageOverride) {
  const excluded = new Set();
  // Age-based exclusions (bypassed by override)
  if (!ageOverride && ageTier) {
    ageTier.excludedIds.forEach(id => excluded.add(id));
  }
  // Injury-based exclusions (always applied)
  limiters.forEach(limiter => {
    const map = INJURY_EXCLUSION_MAP[limiter] || [];
    map.forEach(id => excluded.add(id));
  });
  return excluded;
}

// ─── AGE VOLUME MODIFIERS ─────────────────────────────────────────────────────
// Applied to each slot after exercise selection. Adjusts sets, reps, rest, tempo.
// These are passed to the AI as context so cues + progression also age-match.
const AGE_VOLUME_MODS = {
  PRIME: {
    setsMod: 0,          // no change
    repsStyle: "standard",
    restBonus: 0,        // seconds added to prescribed rest
    tempoNote: null,
    intensityNote: null,
    progressionStyle: "standard",
  },
  EXPERIENCED: {
    setsMod: 0,
    repsStyle: "upper",  // bias toward higher end of rep range
    restBonus: 15,
    tempoNote: "Controlled eccentric — 2 seconds down.",
    intensityNote: "Leave 2–3 reps in reserve. Joint longevity over ego load.",
    progressionStyle: "conservative",
  },
  MASTERS: {
    setsMod: -1,         // subtract 1 set (min 2)
    repsStyle: "hypertrophy", // push into 12–15 range, lower absolute load
    restBonus: 30,
    tempoNote: "3-second eccentric, 1-second pause at bottom.",
    intensityNote: "60–70% effort. Time under tension is the stimulus, not load.",
    progressionStyle: "gradual",
  },
  ELITE_MASTERS: {
    setsMod: -1,         // cap at 2–3 sets
    repsStyle: "endurance", // 12–20 rep range, never to failure
    restBonus: 60,
    tempoNote: "Slow and deliberate — 3s down, 2s up. Full control at all times.",
    intensityNote: "Never to failure. Stop 3–4 reps before form breaks. Quality only.",
    progressionStyle: "maintenance",
  },
};

// Resolve "3–5" or "3-4" to a single integer. highEnd=true picks upper bound.
function resolveRange(str, highEnd = false) {
  if (!str) return str;
  const s = String(str);
  const match = s.match(/^(\d+)[–\-](\d+)/);
  if (!match) return s; // already a single value or non-numeric
  const lo = parseInt(match[1]);
  const hi = parseInt(match[2]);
  return String(highEnd ? hi : lo);
}

// Apply age volume mod to a raw exercise — returns adjusted sets/reps strings
function applyAgeMod(exercise, ageTier, ageOverride) {
  if (!ageTier || ageOverride || ageTier.id === "PRIME") {
    return { sets: resolveRange(exercise.sets, false), reps: exercise.reps };
  }
  const mod = AGE_VOLUME_MODS[ageTier.id];
  if (!mod) return { sets: resolveRange(exercise.sets, false), reps: exercise.reps };

  // Adjust sets — always resolve to a single number
  let sets = exercise.sets;
  const match = sets.match(/^(\d+)(?:[–\-](\d+))?/);
  if (match) {
    let lo = parseInt(match[1]);
    let hi = match[2] ? parseInt(match[2]) : lo;
    lo = Math.max(2, lo + (mod.setsMod||0));
    hi = Math.max(2, hi + (mod.setsMod||0));
    // Resolve: preferLow age tiers get lower bound, others get lower bound too (safe default)
    sets = String(ageTier.preferLow ? lo : lo);
  }

  // Adjust reps based on style
  let reps = exercise.reps;
  if (mod.repsStyle === "upper") {
    // Keep range but note upper end preferred
    reps = exercise.reps; // AI gets the note separately
  } else if (mod.repsStyle === "hypertrophy") {
    // If current reps are low (strength range), shift up
    const lowReps = /^[1-6]/.test(reps);
    if (lowReps) reps = "10–15";
    else {
      const match = reps.match(/^(\d+)[–\-](\d+)/);
      if (match) {
        const lo = Math.max(10, parseInt(match[1]));
        const hi = Math.max(15, parseInt(match[2]));
        reps = `${lo}–${hi}`;
      }
    }
  } else if (mod.repsStyle === "endurance") {
    // Always 12–20 range or higher, never below 10
    const match = reps.match(/^(\d+)/);
    if (match && parseInt(match[1]) < 10) reps = "12–20";
    else {
      const rangeMatch = reps.match(/^(\d+)[–\-](\d+)/);
      if (rangeMatch) {
        const lo = Math.max(12, parseInt(rangeMatch[1]));
        const hi = Math.max(15, parseInt(rangeMatch[2]));
        reps = `${lo}–${hi}`;
      }
    }
  }

  return { sets, reps };
}

function getProtocolTier(fxScores, trackId) {
  const track = TRACKS[trackId];
  if (!track) return 5;
  const axes = track.primaryAxes.map(ax => fxScores[ax] || 50);
  const avg = axes.reduce((a,b) => a+b,0) / axes.length;
  return Math.max(1, Math.min(10, Math.round(avg / 10)));
}

function fillSlot(slotType, trackId, tier, loadout, limiters, usedIds, exclusionSet, tierCap) {
  const effectiveTier = Math.min(tier, tierCap || 10);
  const hasEquip = ex => ex.equipment.length === 0 || ex.equipment.every(e => loadout.includes(e));
  const notLimited = ex => !ex.limitedBy.some(l => limiters.includes(l));
  const notExcluded = ex => !exclusionSet.has(ex.id);

  let candidates = EXERCISES.filter(ex =>
    ex.slot === slotType && ex.tracks.includes(trackId) &&
    hasEquip(ex) && notLimited(ex) && notExcluded(ex) &&
    ex.tier <= (tierCap || 10) &&
    !usedIds.includes(ex.id)
  );

  // Bodyweight fallback — still respect exclusions and tier cap
  if (!candidates.length) {
    candidates = EXERCISES.filter(ex =>
      ex.slot === slotType && ex.equipment.length === 0 &&
      notExcluded(ex) && ex.tier <= (tierCap || 10) &&
      !usedIds.includes(ex.id)
    );
  }
  // Last resort — any exercise for slot, ignore tier cap but keep exclusions
  if (!candidates.length) {
    candidates = EXERCISES.filter(ex =>
      ex.slot === slotType && notExcluded(ex) && !usedIds.includes(ex.id)
    );
  }
  if (!candidates.length) return null;

  const sorted = [...candidates].sort((a,b) => Math.abs(a.tier-effectiveTier) - Math.abs(b.tier-effectiveTier));
  const top = sorted.slice(0, 3);
  return top[Math.floor(Math.random()*top.length)];
}

function generateProtocol(trackId, fxScores, loadout, limiters=[], ageTier=null, ageOverride=false) {
  const track = TRACKS[trackId];
  const rawTier = getProtocolTier(fxScores, trackId);
  const tierCap = (!ageOverride && ageTier) ? ageTier.tierCap : 10;
  const tier = Math.min(rawTier, tierCap);
  const exclusionSet = buildExclusionSet(limiters, ageTier, ageOverride);

  const usedIds = [];
  const slots = track.blueprint.map(slotType => {
    const ex = fillSlot(slotType, trackId, tier, loadout, limiters, usedIds, exclusionSet, tierCap);
    if (ex) {
      usedIds.push(ex.id);
      const { sets, reps } = applyAgeMod(ex, ageTier, ageOverride);
      return { slotType, exercise:ex, sets, reps };
    }
    return null;
  }).filter(Boolean);

  return { trackId, track, tier, tierCap, fxScores, slots, ageTier, ageOverride, exclusionSet };
}

function scoreFX(answers) {
  const scores = {};
  for (const [axisId, questions] of Object.entries(AUDIT_QUESTIONS)) {
    const answered = questions.filter(q => answers[q.id] !== undefined);
    if (!answered.length) { scores[axisId] = 50; continue; }
    const total = answered.reduce((sum,q) => {
      const idx = q.opts.indexOf(answers[q.id]);
      return sum + (idx >= 0 ? q.scores[idx] : 50);
    }, 0);
    scores[axisId] = Math.round(total / answered.length);
  }
  return scores;
}

function fxLabel(s) {
  if (s>=85) return "Elite";
  if (s>=70) return "Advanced";
  if (s>=50) return "Developing";
  if (s>=30) return "Building";
  return "Foundation";
}

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const BG = "#06080C";
const SURFACE = "#0C1018";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.1)";
const TEXT = "#EEF2F8";
const MUTED = "rgba(238,242,248,0.4)";
const FAINT = "rgba(238,242,248,0.07)";
const GOLD = "#F0C060";
const TRACKS_COLOR = { FORGE:"#F87171", SURGE:"#F0C060", FLOW:"#5EEAD4" };
const FD = "'Barlow Condensed', 'Helvetica Neue', sans-serif";
const FB = "'DM Sans', 'Helvetica Neue', sans-serif";

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function FXRadar({ scores, size=180 }) {
  const [anim, setAnim] = useState(false);
  useEffect(()=>{ setTimeout(()=>setAnim(true),300); },[]);
  const cx=size/2, cy=size/2, r=size*0.36;
  const pts = FX_AXES.map((ax,i)=>{
    const angle=(i/FX_AXES.length)*Math.PI*2-Math.PI/2;
    const val = anim ? (scores[ax.id]||0)/100 : 0;
    return { x:cx+Math.cos(angle)*r*val, y:cy+Math.sin(angle)*r*val,
             gx:cx+Math.cos(angle)*r, gy:cy+Math.sin(angle)*r,
             lx:cx+Math.cos(angle)*(r+22), ly:cy+Math.sin(angle)*(r+22), ax };
  });
  const poly = pts.map(p=>`${p.x},${p.y}`).join(" ");
  const grid = [0.3,0.6,1].map(f=>FX_AXES.map((_,i)=>{
    const angle=(i/FX_AXES.length)*Math.PI*2-Math.PI/2;
    return `${cx+Math.cos(angle)*r*f},${cy+Math.sin(angle)*r*f}`;
  }).join(" "));
  return (
    <svg width={size+60} height={size+60} viewBox={`-30 -30 ${size+60} ${size+60}`} style={{overflow:"visible"}}>
      {grid.map((g,i)=><polygon key={i} points={g} fill="none" stroke={BORDER2} strokeWidth="0.5"/>)}
      {pts.map((p,i)=><line key={i} x1={cx} y1={cy} x2={p.gx} y2={p.gy} stroke={BORDER2} strokeWidth="0.5"/>)}
      <polygon points={poly} fill="rgba(240,192,96,0.1)" stroke={GOLD} strokeWidth="1.5" style={{transition:"all 1s cubic-bezier(0.22,1,0.36,1)"}}/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={p.ax.color} style={{transition:"all 1s cubic-bezier(0.22,1,0.36,1)"}}/>
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill={MUTED} fontSize="9" fontFamily={FB} fontWeight="600">{p.ax.name}</text>
        </g>
      ))}
    </svg>
  );
}

function ScoreBar({ score, color, label, sublabel, delay=0 }) {
  const [w, setW] = useState(0);
  useEffect(()=>{ setTimeout(()=>setW(score), 300+delay); },[score]);
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:12,fontWeight:600,color:TEXT}}>{label} <span style={{color:MUTED,fontWeight:400,fontSize:11}}>· {sublabel}</span></span>
        <span style={{fontSize:12,fontWeight:800,color,fontFamily:FD,letterSpacing:"0.04em"}}>{score} <span style={{fontSize:10,color:MUTED,fontFamily:FB,fontWeight:400}}>{fxLabel(score)}</span></span>
      </div>
      <div style={{height:3,background:FAINT,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${w}%`,background:`linear-gradient(90deg,${color}80,${color})`,borderRadius:2,transition:"width 1.1s cubic-bezier(0.22,1,0.36,1)"}}/>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
// Steps: 0=name, 1=age, 2=track, 3=loadout, 4=limiters, 5=audit, 6=profile
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [heightCm, setHeightCm] = useState("");
  const [heightUnit, setHeightUnit] = useState("ft"); // ft | cm
  const [heightFt, setHeightFt] = useState("");  // feet part
  const [heightIn, setHeightIn] = useState("");  // inches part
  const [sex, setSex] = useState(null); // "male" | "female" | "other"
  const [goal, setGoal] = useState(null); // "lose" | "maintain" | "gain"
  const [ageOverride, setAgeOverride] = useState(false);
  const [track, setTrack] = useState(null);
  const [loadout, setLoadout] = useState([]);
  const [limiters, setLimiters] = useState([]);
  const [limiterText, setLimiterText] = useState("");
  const [auditAnswers, setAuditAnswers] = useState({});
  const [auditAxisIdx, setAuditAxisIdx] = useState(0);
  const [fxScores, setFxScores] = useState(null);
  const [nutritionMode, setNutritionMode] = useState(null);
  const [showNutritionStep, setShowNutritionStep] = useState(false);
  const inputRef = useRef();

  // Auto-capitalize name on blur / continue
  const normalizeName = (n) => n.trim().replace(/\b\w/g, c => c.toUpperCase());

  // Convert height inputs to cm for TDEE
  const heightCmComputed = heightUnit === "cm"
    ? parseFloat(heightCm) || null
    : (parseFloat(heightFt)||0)*30.48 + (parseFloat(heightIn)||0)*2.54 || null;

  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(),120); },[step]);

  const selectedTrack = track ? TRACKS[track] : null;
  const accentColor = selectedTrack?.color || GOLD;
  const ageTier = age ? getAgeTier(age) : AGE_TIERS.PRIME;
  const showOverride = ageTier.id !== "PRIME"; // only show for 35+

  const auditAxes = track ? Object.entries(TRACKS[track].auditDepth)
    .sort((a,b)=>b[1]-a[1])
    .map(([axId])=>({ axId, ax:FX_AXES.find(a=>a.id===axId), questions:AUDIT_QUESTIONS[axId] }))
    : [];

  const currentAxis = auditAxes[auditAxisIdx];
  const axisAnswered = currentAxis ? currentAxis.questions.filter(q=>auditAnswers[q.id]!==undefined).length : 0;
  const allAnswered = currentAxis ? axisAnswered === currentAxis.questions.length : false;

  const finishAudit = () => {
    const scores = scoreFX(auditAnswers);
    setFxScores(scores);
    setStep(7); // profile reveal is now step 7
  };

  // Weight in kg — convert if lbs entered
  const weightKgComputed = weightKg
    ? weightUnit === "lbs" ? Math.round(parseFloat(weightKg) * 0.453592) : parseFloat(weightKg)
    : 75;

  const canContinue = () => {
    if (step===0) return name.trim().length>1;
    if (step===1) return age.trim().length>0 && parseInt(age)>=13 && parseInt(age)<=99;
    if (step===2) return true; // weight is optional
    if (step===3) return !!track;
    if (step===4) return true; // empty loadout = bodyweight only
    if (step===5) return true; // limiters optional
    if (step===6) return allAnswered;
    return true;
  };

  return (
    <div style={{minHeight:"100vh",background:BG,fontFamily:FB,color:TEXT,display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        input::placeholder,textarea::placeholder{color:rgba(238,242,248,0.18);}
        ::-webkit-scrollbar{width:2px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07)}
        button{-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* Progress strip */}
      <div style={{height:2,background:FAINT}}>
        <div style={{height:"100%",background:accentColor,width:`${Math.round((step/7)*100)}%`,transition:"width 0.5s ease,background 0.4s ease"}}/>
      </div>

      <div style={{flex:1,maxWidth:500,margin:"0 auto",width:"100%",padding:"28px 22px 0",overflowY:"auto",minHeight:0}}>
        <div style={{fontFamily:FD,fontWeight:800,fontSize:22,letterSpacing:"0.1em",marginBottom:36,color:TEXT}}>
          FIT<span style={{color:accentColor}}>FORGE</span>
        </div>

        {(()=>{
          if (showNutritionStep) return (
            <div key="step-nutrition" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:accentColor,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8}}>STEP 4 OF 8</div>
              <h2 style={{fontFamily:FD,fontSize:34,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:6}}>How do you want to<br/><span style={{color:accentColor}}>track nutrition?</span></h2>
              <p style={{fontSize:13,color:MUTED,lineHeight:1.6,marginBottom:24}}>You can change this anytime in settings.</p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {id:"LOGGER",name:"Simple Logger",icon:"📓",tagline:"Just track what you eat.",desc:"Log meals, see calories. No targets, no coaching. Clean and simple.",color:"#60A5FA"},
                  {id:"TRACKER",name:"Macro Tracker",icon:"📊",tagline:"Hit your numbers.",desc:"TDEE targets, macro rings, calorie burn balance. Data-driven.",color:GOLD},
                  {id:"COACH",name:"Nutrition Coach",icon:"🧠",tagline:"AI tells you what to eat.",desc:"Proactive coaching, meal plans, snack ideas, morning and evening recaps.",color:"#A78BFA",pro:true},
                ].map(mode=>(
                  <button key={mode.id} onClick={()=>setNutritionMode(mode.id)} style={{
                    padding:"18px 20px",borderRadius:18,
                    border:`2px solid ${nutritionMode===mode.id?mode.color:BORDER2}`,
                    background:nutritionMode===mode.id?`${mode.color}08`:SURFACE,
                    cursor:"pointer",textAlign:"left",transition:"all 0.15s",
                    boxShadow:nutritionMode===mode.id?`0 4px 20px ${mode.color}20`:"none"
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:26}}>{mode.icon}</span>
                        <div>
                          <div style={{fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.04em",color:nutritionMode===mode.id?mode.color:TEXT}}>{mode.name}</div>
                          <div style={{fontSize:11,color:mode.color,fontWeight:600,marginTop:1}}>{mode.tagline}</div>
                        </div>
                      </div>
                      {mode.pro&&<span style={{fontSize:10,padding:"3px 9px",borderRadius:6,background:`${mode.color}15`,color:mode.color,fontWeight:700}}>PRO</span>}
                    </div>
                    <div style={{fontSize:12,color:MUTED,lineHeight:1.6,marginLeft:36}}>{mode.desc}</div>
                  </button>
                ))}
              </div>
              <button disabled={!nutritionMode} onClick={()=>{setShowNutritionStep(false);setStep(4);}} style={{
                width:"100%",padding:"18px",borderRadius:14,border:"none",marginTop:24,
                background:nutritionMode?({LOGGER:"#60A5FA",TRACKER:GOLD,COACH:"#A78BFA"}[nutritionMode]):FAINT,
                color:nutritionMode?BG:MUTED,
                fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
                cursor:nutritionMode?"pointer":"not-allowed",transition:"all 0.2s"
              }}>CONTINUE →</button>
            </div>
          );
          if (step===0) return (
            <div key="s0" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>INITIALIZE PROFILE</div>
              <h2 style={{fontFamily:FD,fontSize:42,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>What do we<br/><span style={{color:GOLD}}>call you?</span></h2>
              <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:32}}>Your name is embedded in every protocol we generate for you.</p>
              <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)} onBlur={()=>setName(n=>normalizeName(n))} onKeyDown={e=>e.key==="Enter"&&canContinue()&&(setName(normalizeName(name)),setStep(1))} placeholder="Enter your name..." style={{width:"100%",background:SURFACE,border:`1.5px solid ${name?GOLD:BORDER2}`,borderRadius:14,padding:"16px 18px",color:TEXT,fontFamily:FB,fontSize:18,fontWeight:600,outline:"none",transition:"border-color 0.2s"}}/>
            </div>
          );
          if (step===1) return (
            <div key="s1" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>AGE CALIBRATION</div>
              <h2 style={{fontFamily:FD,fontSize:42,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>How old<br/><span style={{color:GOLD}}>are you, {name}?</span></h2>
              <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:28}}>Age calibrates your Protocol Tier ceiling and filters movement risk by default. You can always override.</p>
              <input ref={inputRef} type="number" min="13" max="99" value={age} onChange={e=>setAge(e.target.value)} onKeyDown={e=>e.key==="Enter"&&canContinue()&&setStep(2)} placeholder="Your age" style={{width:"100%",background:SURFACE,border:`1.5px solid ${age&&parseInt(age)>=13?GOLD:BORDER2}`,borderRadius:14,padding:"16px 18px",color:TEXT,fontFamily:FD,fontSize:32,fontWeight:800,outline:"none",transition:"border-color 0.2s",letterSpacing:"0.08em",marginBottom:20}}/>
              {age && parseInt(age)>=13 && (
                <div style={{animation:"fadeUp 0.25s ease"}}>
                  <div style={{padding:"18px 20px",borderRadius:16,background:`${ageTier.color}0E`,border:`1.5px solid ${ageTier.color}30`,marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:ageTier.color,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:4}}>YOUR AGE TIER</div>
                        <div style={{fontFamily:FD,fontSize:28,fontWeight:800,letterSpacing:"0.04em",color:TEXT}}>{ageTier.icon} {ageTier.label}</div>
                        <div style={{fontSize:12,color:MUTED,marginTop:3}}>Ages {ageTier.range}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>TIER CAP</div>
                        <div style={{fontFamily:FD,fontSize:36,fontWeight:800,color:ageTier.color,lineHeight:1}}>{ageTier.tierCap}<span style={{fontSize:16,color:MUTED}}>/10</span></div>
                      </div>
                    </div>
                    <p style={{fontSize:13,color:MUTED,lineHeight:1.65,margin:0}}>{ageTier.desc}</p>
                  </div>
                  {showOverride && (
                    <button onClick={()=>setAgeOverride(o=>!o)} style={{width:"100%",padding:"16px 18px",borderRadius:14,border:`1.5px solid ${ageOverride?"#34D399":"rgba(52,211,153,0.25)"}`,background:ageOverride?"rgba(52,211,153,0.08)":SURFACE,cursor:"pointer",fontFamily:FB,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
                      <div style={{textAlign:"left"}}>
                        <div style={{fontSize:13,fontWeight:700,color:ageOverride?"#34D399":TEXT,marginBottom:3}}>{ageOverride?"✓ Override Active":"I'm active & experienced — remove age limits"}</div>
                        <div style={{fontSize:11,color:MUTED,lineHeight:1.5}}>{ageOverride?"Full exercise library unlocked. Injury limiters still apply.":"Lifts the tier cap and unlocks age-restricted movements."}</div>
                      </div>
                      <div style={{width:44,height:24,borderRadius:12,background:ageOverride?"#34D399":FAINT,border:`1px solid ${ageOverride?"#34D399":BORDER2}`,position:"relative",flexShrink:0,marginLeft:14,transition:"all 0.25s"}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:"white",position:"absolute",top:3,left:ageOverride?22:3,transition:"left 0.25s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                      </div>
                    </button>
                  )}
                  <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                    {Object.values(AGE_TIERS).map(t=>(
                      <div key={t.id} style={{padding:"10px 8px",borderRadius:10,textAlign:"center",background:t.id===ageTier.id?`${t.color}10`:FAINT,border:`1px solid ${t.id===ageTier.id?t.color+"40":BORDER}`}}>
                        <div style={{fontSize:14,marginBottom:4}}>{t.icon}</div>
                        <div style={{fontSize:9,fontWeight:700,color:t.id===ageTier.id?t.color:MUTED,letterSpacing:"0.06em",textTransform:"uppercase"}}>{t.label}</div>
                        <div style={{fontSize:8,color:MUTED,marginTop:2}}>{t.range}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          if (step===2) return (
            <div key="s2" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>BODY METRICS</div>
              <h2 style={{fontFamily:FD,fontSize:42,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:6}}>Tell us about<br/><span style={{color:GOLD}}>your body.</span></h2>
              <p style={{color:MUTED,fontSize:13,lineHeight:1.6,marginBottom:24}}>Powers calorie estimates, TDEE targets, and nutrition coaching. All optional.</p>

              {/* WEIGHT */}
              <div style={{marginBottom:22}}>
                <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Weight</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {["lbs","kg"].map(u=>(
                    <button key={u} onClick={()=>setWeightUnit(u)} style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${weightUnit===u?GOLD:BORDER2}`,background:weightUnit===u?"rgba(240,192,96,0.1)":SURFACE,color:weightUnit===u?GOLD:MUTED,cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.08em",transition:"all 0.15s"}}>{u.toUpperCase()}</button>
                  ))}
                </div>
                <input ref={inputRef} type="number" min="30" max="500" value={weightKg} onChange={e=>setWeightKg(e.target.value)} placeholder={weightUnit==="lbs"?"e.g. 175":"e.g. 80"} style={{width:"100%",background:SURFACE,border:`1.5px solid ${weightKg?GOLD:BORDER2}`,borderRadius:12,padding:"14px 18px",color:TEXT,fontFamily:FD,fontSize:28,fontWeight:800,outline:"none",transition:"border-color 0.2s",letterSpacing:"0.06em"}}/>
                {weightKg&&<div style={{marginTop:6,fontSize:12,color:MUTED}}>≈ {weightUnit==="lbs"?`${Math.round(parseFloat(weightKg)*0.453592)} kg`:`${Math.round(parseFloat(weightKg)*2.205)} lbs`}</div>}
              </div>

              {/* HEIGHT */}
              <div style={{marginBottom:22}}>
                <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Height</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {["ft","cm"].map(u=>(
                    <button key={u} onClick={()=>setHeightUnit(u)} style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${heightUnit===u?GOLD:BORDER2}`,background:heightUnit===u?"rgba(240,192,96,0.1)":SURFACE,color:heightUnit===u?GOLD:MUTED,cursor:"pointer",fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.08em",transition:"all 0.15s"}}>{u.toUpperCase()}</button>
                  ))}
                </div>
                {heightUnit==="ft" ? (
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1}}>
                      <input type="number" min="4" max="7" value={heightFt} onChange={e=>setHeightFt(e.target.value)} placeholder="5" style={{width:"100%",background:SURFACE,border:`1.5px solid ${heightFt?GOLD:BORDER2}`,borderRadius:12,padding:"14px 18px",color:TEXT,fontFamily:FD,fontSize:28,fontWeight:800,outline:"none",transition:"border-color 0.2s",letterSpacing:"0.06em"}}/>
                      <div style={{fontSize:11,color:MUTED,marginTop:4,textAlign:"center"}}>feet</div>
                    </div>
                    <div style={{flex:1}}>
                      <input type="number" min="0" max="11" value={heightIn} onChange={e=>setHeightIn(e.target.value)} placeholder="10" style={{width:"100%",background:SURFACE,border:`1.5px solid ${heightIn?GOLD:BORDER2}`,borderRadius:12,padding:"14px 18px",color:TEXT,fontFamily:FD,fontSize:28,fontWeight:800,outline:"none",transition:"border-color 0.2s",letterSpacing:"0.06em"}}/>
                      <div style={{fontSize:11,color:MUTED,marginTop:4,textAlign:"center"}}>inches</div>
                    </div>
                  </div>
                ) : (
                  <input type="number" min="100" max="230" value={heightCm} onChange={e=>setHeightCm(e.target.value)} placeholder="e.g. 178" style={{width:"100%",background:SURFACE,border:`1.5px solid ${heightCm?GOLD:BORDER2}`,borderRadius:12,padding:"14px 18px",color:TEXT,fontFamily:FD,fontSize:28,fontWeight:800,outline:"none",transition:"border-color 0.2s",letterSpacing:"0.06em"}}/>
                )}
                {heightCmComputed&&<div style={{marginTop:6,fontSize:12,color:MUTED}}>≈ {heightUnit==="cm"?`${Math.floor(heightCmComputed/30.48)}′${Math.round((heightCmComputed%30.48)/2.54)}″`:`${Math.round(heightCmComputed)} cm`}</div>}
              </div>

              {/* SEX */}
              <div style={{marginBottom:22}}>
                <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Biological Sex <span style={{fontWeight:400,fontSize:10}}>(for TDEE accuracy)</span></div>
                <div style={{display:"flex",gap:8}}>
                  {[{id:"male",label:"Male"},{id:"female",label:"Female"},{id:"other",label:"Prefer not to say"}].map(s=>(
                    <button key={s.id} onClick={()=>setSex(s.id)} style={{
                      flex:s.id==="other"?1.6:1,padding:"11px 6px",borderRadius:11,
                      border:`1.5px solid ${sex===s.id?GOLD:BORDER2}`,
                      background:sex===s.id?"rgba(240,192,96,0.1)":SURFACE,
                      color:sex===s.id?GOLD:MUTED,
                      cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:sex===s.id?700:400,
                      transition:"all 0.15s",textAlign:"center"
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>

              {/* GOAL */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Primary Goal</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {[
                    {id:"lose",    label:"Lose fat",      sub:"Calorie deficit — preserve muscle",      color:"#60A5FA"},
                    {id:"maintain",label:"Maintain",      sub:"Balanced energy in/out",                 color:GOLD},
                    {id:"gain",    label:"Build & gain",  sub:"Calorie surplus — prioritize strength",  color:"#34D399"},
                  ].map(g=>(
                    <button key={g.id} onClick={()=>setGoal(g.id)} style={{
                      padding:"13px 16px",borderRadius:12,textAlign:"left",
                      border:`1.5px solid ${goal===g.id?g.color:BORDER2}`,
                      background:goal===g.id?`${g.color}0D`:SURFACE,
                      cursor:"pointer",fontFamily:FB,display:"flex",justifyContent:"space-between",alignItems:"center",
                      transition:"all 0.15s"
                    }}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:goal===g.id?g.color:TEXT}}>{g.label}</div>
                        <div style={{fontSize:11,color:MUTED,marginTop:2}}>{g.sub}</div>
                      </div>
                      {goal===g.id&&<div style={{fontSize:16,color:g.color}}>✓</div>}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{marginTop:14,padding:"10px 14px",borderRadius:10,background:FAINT,fontSize:11,color:MUTED}}>🔒 Never shown to others. Used only for calorie + nutrition targets.</div>
            </div>
          );
          if (step===3) return (
            <div key="s3" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>SELECT YOUR TRACK</div>
              <h2 style={{fontFamily:FD,fontSize:40,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>{name}, choose<br/><span style={{color:GOLD}}>your protocol.</span></h2>
              <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:24}}>Your track sets the blueprint slot order for every session generated.</p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {Object.values(TRACKS).map(t=>(
                  <button key={t.id} onClick={()=>setTrack(t.id)} style={{padding:"20px",borderRadius:18,textAlign:"left",border:`2px solid ${track===t.id?t.color:BORDER2}`,background:track===t.id?t.colorDim:SURFACE,cursor:"pointer",fontFamily:FB,transition:"all 0.2s",boxShadow:track===t.id?`0 0 28px ${t.color}18`:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{fontFamily:FD,fontSize:30,fontWeight:800,letterSpacing:"0.06em",color:track===t.id?t.color:TEXT}}>{t.icon} {t.name}</div>
                      {track===t.id&&<div style={{color:t.color,fontSize:18}}>✓</div>}
                    </div>
                    <div style={{fontSize:12,color:t.color,fontWeight:600,marginBottom:8}}>{t.tagline}</div>
                    <p style={{fontSize:12,color:MUTED,lineHeight:1.6,marginBottom:12}}>{t.description}</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {t.blueprint.map((s,i)=>(<span key={i} style={{fontSize:9,padding:"3px 8px",borderRadius:5,background:`${SLOT_COLORS[s]}15`,color:SLOT_COLORS[s],fontWeight:800,letterSpacing:"0.06em"}}>{s}</span>))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
          if (step===4) return (
            <div key="s4" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:accentColor,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>CONFIGURE LOADOUT</div>
              <h2 style={{fontFamily:FD,fontSize:40,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>What's in your<br/><span style={{color:accentColor}}>loadout?</span></h2>
              <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:16}}>The Protocol Engine only assigns exercises you can actually perform. Be accurate.</p>
              <button onClick={()=>setLoadout([])} style={{
                width:"100%",padding:"14px",borderRadius:14,marginBottom:20,cursor:"pointer",
                border:`2px solid ${loadout.length===0?accentColor:BORDER2}`,
                background:loadout.length===0?`${accentColor}12`:SURFACE,
                display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                color:loadout.length===0?accentColor:MUTED,
                fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.06em",
                transition:"all 0.15s"
              }}>
                {loadout.length===0?"✓ BODYWEIGHT / NO EQUIPMENT":"🏃 BODYWEIGHT / NO EQUIPMENT"}
              </button>
              {[
                {cat:"weights",  label:"Free Weights"},
                {cat:"machines", label:"Machines & Racks"},
                {cat:"bodyweight",label:"Bodyweight & Gymnastics"},
                {cat:"cardio",   label:"Cardio"},
                {cat:"functional",label:"Combat & Functional"},
              ].map(({cat,label})=>{
                const items = LOADOUT.filter(e=>e.category===cat);
                return (
                  <div key={cat} style={{marginBottom:16}}>
                    <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {items.map(eq=>{
                        const active=loadout.includes(eq.id);
                        return (<button key={eq.id} onClick={()=>setLoadout(prev=>prev.includes(eq.id)?prev.filter(e=>e!==eq.id):[...prev,eq.id])} style={{padding:"8px 13px",borderRadius:11,display:"flex",alignItems:"center",gap:6,border:`1.5px solid ${active?accentColor:BORDER2}`,background:active?`${accentColor}12`:SURFACE,color:active?accentColor:MUTED,cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:active?700:400,transition:"all 0.15s"}}>{eq.icon} {eq.label}</button>);
                      })}
                    </div>
                  </div>
                );
              })}
              {loadout.length>0&&(<div style={{padding:"10px 14px",borderRadius:10,background:FAINT,fontSize:12,color:MUTED}}>{loadout.length} item{loadout.length!==1?"s":""} selected</div>)}
            </div>
          );
          if (step===5) return (
            <div key="s5" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:accentColor,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>BIOLOGICAL CONSTRAINTS</div>
              <h2 style={{fontFamily:FD,fontSize:40,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>Any injuries<br/><span style={{color:accentColor}}>or limiters?</span></h2>
              <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:22}}>Exercises stressing flagged zones are automatically excluded from your protocol.</p>
              {ageTier.id!=="PRIME"&&!ageOverride&&(<div style={{padding:"12px 14px",borderRadius:12,background:`${ageTier.color}0C`,border:`1px solid ${ageTier.color}25`,marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}><span style={{fontSize:16,flexShrink:0}}>{ageTier.icon}</span><div><div style={{fontSize:11,color:ageTier.color,fontWeight:700,marginBottom:2}}>{ageTier.label} age defaults active</div><div style={{fontSize:11,color:MUTED,lineHeight:1.5}}>{ageTier.desc} These stack with your manual selections below.</div></div></div>)}
              {ageOverride&&(<div style={{padding:"12px 14px",borderRadius:12,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.25)",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:16}}>✓</span><div style={{fontSize:11,color:"#34D399",fontWeight:600}}>Age override active — only your manual limiters below apply.</div></div>)}
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
                {COMMON_LIMITERS.map(l=>{
                  const active=limiters.includes(l.id);
                  return (<button key={l.id} onClick={()=>setLimiters(prev=>prev.includes(l.id)?prev.filter(x=>x!==l.id):[...prev,l.id])} style={{padding:"9px 14px",borderRadius:11,border:`1.5px solid ${active?"#F87171":BORDER2}`,background:active?"rgba(248,113,113,0.1)":SURFACE,color:active?"#F87171":MUTED,cursor:"pointer",fontFamily:FB,fontSize:13,fontWeight:active?700:400,display:"flex",alignItems:"center",gap:6,transition:"all 0.15s"}}>{active?"🔴":"⭕"} {l.label}</button>);
                })}
              </div>
              <div style={{marginBottom:8,fontSize:12,color:MUTED,fontWeight:600}}>Anything else — describe in your words:</div>
              <textarea value={limiterText} onChange={e=>setLimiterText(e.target.value)} placeholder="e.g. right shoulder impingement, recovering from hamstring strain..." rows={3} style={{width:"100%",background:SURFACE,border:`1.5px solid ${BORDER2}`,borderRadius:12,padding:"12px 16px",color:TEXT,fontFamily:FB,fontSize:13,outline:"none",resize:"none",lineHeight:1.6}}/>
              <div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:FAINT,fontSize:12,color:MUTED}}>{limiters.length===0&&!limiterText?"No manual limiters — age defaults still apply.":`${limiters.length} limiter${limiters.length!==1?"s":""} flagged. These will exclude specific movements from your protocol.`}</div>
            </div>
          );
          if (step===6&&currentAxis) return (
            <div key={`axis-${auditAxisIdx}`} style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{fontSize:10,color:currentAxis.ax.color,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase"}}>FX AUDIT · {currentAxis.ax.name.toUpperCase()}</div>
                <div style={{fontSize:11,color:MUTED}}>Axis {auditAxisIdx+1} of {auditAxes.length}</div>
              </div>
              <div style={{padding:"16px 18px",borderRadius:16,background:`${currentAxis.ax.color}0E`,border:`1px solid ${currentAxis.ax.color}28`,marginBottom:24,display:"flex",gap:14,alignItems:"center"}}>
                <span style={{fontSize:34}}>{currentAxis.ax.icon}</span>
                <div>
                  <div style={{fontFamily:FD,fontSize:24,fontWeight:800,letterSpacing:"0.06em",color:currentAxis.ax.color}}>{currentAxis.ax.name.toUpperCase()}</div>
                  <div style={{fontSize:12,color:MUTED,marginTop:2}}>{currentAxis.ax.desc}</div>
                </div>
              </div>
              {currentAxis.questions.map((q,qi)=>(
                <div key={q.id} style={{marginBottom:22}}>
                  <div style={{fontSize:14,fontWeight:600,color:TEXT,marginBottom:10,lineHeight:1.5}}>{qi+1}. {q.text}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {q.opts.map(opt=>{const sel=auditAnswers[q.id]===opt;return(<button key={opt} onClick={()=>setAuditAnswers(prev=>({...prev,[q.id]:opt}))} style={{padding:"11px 16px",borderRadius:12,textAlign:"left",border:`1.5px solid ${sel?currentAxis.ax.color:BORDER2}`,background:sel?`${currentAxis.ax.color}10`:SURFACE,color:sel?currentAxis.ax.color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13,fontWeight:sel?700:400,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}>{opt}{sel&&<span>✓</span>}</button>);})}
                  </div>
                </div>
              ))}
              <div style={{height:3,background:FAINT,borderRadius:2,overflow:"hidden",marginTop:16,marginBottom:6}}>
                <div style={{height:"100%",width:`${(axisAnswered/currentAxis.questions.length)*100}%`,background:currentAxis.ax.color,borderRadius:2,transition:"width 0.3s ease"}}/>
              </div>
              <div style={{fontSize:11,color:MUTED,textAlign:"center"}}>{axisAnswered}/{currentAxis.questions.length} answered</div>
            </div>
          );
          if (step===7&&fxScores) return (
            <div key="s7" style={{animation:"fadeUp 0.35s ease"}}>
              <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>FORGE INDEX RESULTS</div>
              <h2 style={{fontFamily:FD,fontSize:40,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:12}}>{name}'s<br/><span style={{color:GOLD}}>FX Profile.</span></h2>
              <div style={{display:"flex",justifyContent:"center",margin:"20px 0"}}><FXRadar scores={fxScores} size={190}/></div>
              <div style={{padding:"18px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:18}}>
                {FX_AXES.map((ax,i)=>(<ScoreBar key={ax.id} score={fxScores[ax.id]||50} color={ax.color} label={`${ax.icon} ${ax.name}`} sublabel={ax.unit} delay={i*100}/>))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                <div style={{padding:"16px",borderRadius:14,background:selectedTrack.colorDim,border:`1px solid ${selectedTrack.color}30`,textAlign:"center"}}>
                  <div style={{fontSize:10,color:selectedTrack.color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>TRACK</div>
                  <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:selectedTrack.color,letterSpacing:"0.04em"}}>{selectedTrack.icon} {selectedTrack.name}</div>
                </div>
                <div style={{padding:"16px",borderRadius:14,background:FAINT,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
                  <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>PROTOCOL TIER</div>
                  <div style={{fontFamily:FD,fontSize:44,fontWeight:800,color:TEXT,lineHeight:1}}>{getProtocolTier(fxScores,track)}<span style={{fontSize:18,color:MUTED}}>/10</span></div>
                </div>
              </div>
              <div style={{padding:"13px 16px",borderRadius:14,background:`${ageTier.color}0C`,border:`1px solid ${ageTier.color}25`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:20}}>{ageTier.icon}</span>
                  <div>
                    <div style={{fontSize:11,color:ageTier.color,fontWeight:700,letterSpacing:"0.08em"}}>{ageTier.label.toUpperCase()} · Age {age}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>Tier cap: {ageOverride?"Unlocked":ageTier.tierCap+"/10"}</div>
                  </div>
                </div>
                {ageOverride&&<div style={{fontSize:11,color:"#34D399",fontWeight:700,background:"rgba(52,211,153,0.1)",padding:"4px 10px",borderRadius:8}}>OVERRIDE ON</div>}
              </div>
            </div>
          );
          return null;
        })()}
      </div>

      {/* Bottom CTA */}
      <div style={{maxWidth:500,margin:"0 auto",width:"100%",padding:"18px 22px",display:"flex",gap:10}}>
        {step>0 && step!==7 && step!==6 && !showNutritionStep && (
          <button onClick={()=>setStep(s=>s-1)} style={{padding:"13px 18px",borderRadius:14,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:14}}>←</button>
        )}
        {showNutritionStep && (
          <button onClick={()=>setShowNutritionStep(false)} style={{padding:"13px 18px",borderRadius:14,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:14}}>←</button>
        )}
        {step===6 && auditAxisIdx>0 && (
          <button onClick={()=>setAuditAxisIdx(i=>i-1)} style={{padding:"13px 18px",borderRadius:14,background:"transparent",border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:14}}>←</button>
        )}

        {step<6 && !showNutritionStep && (
          <button disabled={!canContinue()} onClick={()=>{
            // After track selection (step 3), show nutrition mode step before loadout
            if (step===3 && canContinue()) { setShowNutritionStep(true); return; }
            setStep(s=>s+1);
          }} style={{
            flex:1,padding:"16px",borderRadius:14,border:"none",
            background:canContinue()?accentColor:FAINT,
            color:canContinue()?BG:MUTED,
            fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
            cursor:canContinue()?"pointer":"not-allowed",transition:"all 0.2s",
            boxShadow:canContinue()?`0 6px 24px ${accentColor}30`:"none"
          }}>
            {step===5?"BEGIN FX AUDIT →":"CONTINUE →"}
          </button>
        )}
        {step===6 && (
          <button disabled={!allAnswered} onClick={()=>{ if(auditAxisIdx<auditAxes.length-1) setAuditAxisIdx(i=>i+1); else finishAudit(); }} style={{
            flex:1,padding:"16px",borderRadius:14,border:"none",
            background:allAnswered?(currentAxis?.ax.color||GOLD):FAINT,
            color:allAnswered?BG:MUTED,
            fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
            cursor:allAnswered?"pointer":"not-allowed",transition:"all 0.2s"
          }}>
            {auditAxisIdx<auditAxes.length-1?"NEXT AXIS →":"GENERATE PROFILE →"}
          </button>
        )}
        {step===7 && (
          <button onClick={()=>onComplete({name:normalizeName(name),age:parseInt(age),weightKg:weightKgComputed,heightCm:heightCmComputed,sex,goal:goal||"maintain",ageTier,ageOverride,track,loadout,limiters,limiterText,fxScores,nutritionMode:nutritionMode||"LOGGER"})} style={{
            flex:1,padding:"16px",borderRadius:14,border:"none",
            background:selectedTrack.color,color:BG,
            fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
            cursor:"pointer",boxShadow:`0 6px 32px ${selectedTrack.color}35`
          }}>
            ENTER FITFORGE →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PROTOCOL SCREEN ──────────────────────────────────────────────────────────
// ─── POST SESSION CHECK-IN (inline, no WorkoutTimer.jsx dependency needed) ────
// ─── ADAPTIVE SESSION RECAP ──────────────────────────────────────────────────
function PostSessionCheckin({ track, slots=[], duration=0, onDone }) {
  const [mode]          = useState(()=>getTrackingMode());
  const [step,  setStep]  = useState("mode_check"); // mode_check | per_exercise | overall | saved
  const [slotIdx, setSlotIdx] = useState(0);
  const [slotLogs, setSlotLogs] = useState({}); // { exerciseId: log }
  const [effort, setEffort] = useState(null);
  const [feel,   setFeel]   = useState(null);
  const [note,   setNote]   = useState("");
  const [chosenMode, setChosenMode] = useState(mode);

  const C = track.color;
  const totalSlots = slots.length;
  const curSlot = slots[slotIdx];

  const exId = (s, i) => slugify(s?.exerciseName || s?.exercise || s?.name || "") || `slot-${i ?? slotIdx}`;

  // ── Mode selection (first time only) ──
  if (step === "mode_check") return (
    <div style={{padding:"20px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
      <div style={{fontSize:10,color:C,fontWeight:700,letterSpacing:"0.12em",marginBottom:14}}>HOW DO YOU WANT TO TRACK?</div>
      <p style={{fontSize:13,color:MUTED,lineHeight:1.6,marginBottom:18}}>Choose your style. You can change this anytime in settings.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {Object.values(TRACKING_MODES).map(m=>(
          <button key={m.id} onClick={()=>setChosenMode(m.id)} style={{
            padding:"16px",borderRadius:14,border:`2px solid ${chosenMode===m.id?C:BORDER2}`,
            background:chosenMode===m.id?`${C}10`:SURFACE,
            cursor:"pointer",textAlign:"left",transition:"all 0.15s"
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:22}}>{m.icon}</span>
              <div style={{fontFamily:FD,fontSize:18,fontWeight:800,color:chosenMode===m.id?C:TEXT,letterSpacing:"0.04em"}}>{m.label}</div>
              {chosenMode===m.id&&<div style={{marginLeft:"auto",fontSize:12,color:C,fontWeight:700}}>✓ SELECTED</div>}
            </div>
            <div style={{fontSize:12,color:MUTED,paddingLeft:32}}>{m.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={()=>{ setTrackingMode(chosenMode); setStep(chosenMode==="DETAILED"?"per_exercise":"overall"); }} style={{
        width:"100%",padding:"14px",borderRadius:12,border:"none",
        background:C,color:BG,fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.06em",cursor:"pointer"
      }}>LET'S GO →</button>
    </div>
  );

  // ── Per-exercise logging (DETAILED mode) ──
  if (step === "per_exercise" && curSlot) {
    const id = exId(curSlot, slotIdx);
    const log = slotLogs[id] || {};
    const { lo, hi, isTime } = parseRepsForDisplay(curSlot.reps);
    const prescribed = `${curSlot.sets} × ${curSlot.reps}`;

    const setLog = (patch) => setSlotLogs(prev=>({...prev,[id]:{...prev[id],...patch}}));
    const nextSlot = () => {
      if (slotIdx + 1 < totalSlots) setSlotIdx(i=>i+1);
      else setStep("overall");
    };

    return (
      <div style={{padding:"20px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:10,color:C,fontWeight:700,letterSpacing:"0.12em"}}>EXERCISE {slotIdx+1} OF {totalSlots}</div>
          <div style={{display:"flex",gap:4}}>
            {slots.map((_,i)=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:i<=slotIdx?C:BORDER2}}/>)}
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:TEXT,letterSpacing:"0.02em"}}>{curSlot.exerciseName||curSlot.exercise}</div>
          <div style={{fontSize:12,color:MUTED,marginTop:3}}>Prescribed: {prescribed}</div>
        </div>

        {/* Status */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8}}>HOW DID IT GO?</div>
          <div style={{display:"flex",gap:7}}>
            {[
              {id:"done",    label:"✓ Completed", color:"#34D399"},
              {id:"partial", label:"⚡ Partial",   color:C},
              {id:"skipped", label:"✕ Skipped",   color:"#F87171"},
            ].map(s=>(
              <button key={s.id} onClick={()=>setLog({status:s.id})} style={{
                flex:1,padding:"10px 6px",borderRadius:10,
                border:`1.5px solid ${log.status===s.id?s.color:BORDER2}`,
                background:log.status===s.id?`${s.color}12`:SURFACE,
                color:log.status===s.id?s.color:MUTED,
                cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:log.status===s.id?700:400,
                transition:"all 0.15s",textAlign:"center"
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Actual reps/time — shown when partial or done */}
        {(log.status==="done"||log.status==="partial") && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8}}>
              {isTime ? "ACTUAL TIME (seconds)" : "ACTUAL REPS (last set)"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setLog({actualReps:Math.max(0,(log.actualReps||lo)-1)})} style={{width:38,height:38,borderRadius:10,background:FAINT,border:`1px solid ${BORDER2}`,color:TEXT,cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <div style={{flex:1,textAlign:"center",fontFamily:FD,fontSize:32,fontWeight:800,color:C}}>{log.actualReps??lo}</div>
              <button onClick={()=>setLog({actualReps:(log.actualReps||lo)+1})} style={{width:38,height:38,borderRadius:10,background:FAINT,border:`1px solid ${BORDER2}`,color:TEXT,cursor:"pointer",fontSize:20,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            </div>
            {!isTime&&<div style={{textAlign:"center",fontSize:11,color:MUTED,marginTop:4}}>Target: {lo}–{hi}</div>}
          </div>
        )}

        {/* Weight (optional) */}
        {(log.status==="done"||log.status==="partial") && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8}}>WEIGHT USED (lbs/kg — optional)</div>
            <input
              type="number" value={log.weight||""} onChange={e=>setLog({weight:e.target.value})}
              placeholder="e.g. 135"
              style={{width:"100%",background:BG,border:`1px solid ${BORDER2}`,borderRadius:10,padding:"10px 14px",color:TEXT,fontFamily:FB,fontSize:16,outline:"none"}}
            />
          </div>
        )}

        {/* Effort */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8}}>EFFORT</div>
          <div style={{display:"flex",gap:6}}>
            {["😤 Easy","💪 Solid","🔥 Hard","💀 Max"].map((e,i)=>(
              <button key={i} onClick={()=>setLog({effort:i+1})} style={{
                flex:1,padding:"8px 2px",borderRadius:9,
                border:`1.5px solid ${log.effort===i+1?C:BORDER2}`,
                background:log.effort===i+1?`${C}12`:SURFACE,
                color:log.effort===i+1?C:MUTED,
                cursor:"pointer",fontFamily:FB,fontSize:10,fontWeight:log.effort===i+1?700:400,
                transition:"all 0.15s",textAlign:"center"
              }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:8}}>
          {slotIdx > 0 && <button onClick={()=>setSlotIdx(i=>i-1)} style={{padding:"12px 16px",borderRadius:11,background:FAINT,border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FD,fontSize:14,fontWeight:700}}>← Back</button>}
          <button onClick={()=>{ if(!log.status) setLog({status:"done"}); nextSlot(); }} style={{
            flex:1,padding:"13px",borderRadius:11,border:"none",
            background:C,color:BG,fontFamily:FD,fontSize:16,fontWeight:800,
            letterSpacing:"0.06em",cursor:"pointer"
          }}>{slotIdx+1<totalSlots?"NEXT EXERCISE →":"FINISH LOGGING →"}</button>
        </div>
      </div>
    );
  }

  // ── Overall session feel (both modes) ──
  if (step === "overall") return (
    <div style={{padding:"20px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
      <div style={{fontSize:10,color:C,fontWeight:700,letterSpacing:"0.12em",marginBottom:16}}>SESSION CHECK-IN</div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,color:TEXT,marginBottom:10}}>Overall effort?</div>
        <div style={{display:"flex",gap:7}}>
          {["😤 Easy","💪 Solid","🔥 Hard","💀 Max"].map((e,i)=>(
            <button key={i} onClick={()=>setEffort(i+1)} style={{
              flex:1,padding:"10px 4px",borderRadius:10,border:`1.5px solid ${effort===i+1?C:BORDER2}`,
              background:effort===i+1?`${C}12`:SURFACE,
              color:effort===i+1?C:MUTED,cursor:"pointer",fontFamily:FB,fontSize:11,fontWeight:effort===i+1?700:400,
              transition:"all 0.15s",textAlign:"center"
            }}>{e}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,color:TEXT,marginBottom:10}}>How do you feel?</div>
        <div style={{display:"flex",gap:7}}>
          {["😴 Drained","😐 Neutral","😊 Good","⚡ Great"].map((f,i)=>(
            <button key={i} onClick={()=>setFeel(i+1)} style={{
              flex:1,padding:"10px 4px",borderRadius:10,border:`1.5px solid ${feel===i+1?C:BORDER2}`,
              background:feel===i+1?`${C}12`:SURFACE,
              color:feel===i+1?C:MUTED,cursor:"pointer",fontFamily:FB,fontSize:11,fontWeight:feel===i+1?700:400,
              transition:"all 0.15s",textAlign:"center"
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Smart mode — quick per-exercise status */}
      {chosenMode === "SMART" && slots.length > 0 && (
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>ANY EXERCISES THAT WERE ROUGH? (optional)</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {slots.map((s,i)=>{
              const id = exId(s, i);
              const log = slotLogs[id]||{};
              const name = s.exerciseName||s.exercise||s.name||`Exercise ${i+1}`;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:11,background:FAINT,border:`1px solid ${BORDER}`}}>
                  <div style={{fontSize:13,fontWeight:600,color:TEXT,flex:1,marginRight:10}}>{name}</div>
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    {[{id:"done",icon:"✓",color:"#34D399"},{id:"partial",icon:"⚡",color:C},{id:"skipped",icon:"✕",color:"#F87171"}].map(st=>(
                      <button key={st.id} onClick={()=>setSlotLogs(prev=>({...prev,[id]:{...prev[id],status:st.id}}))} style={{
                        width:30,height:30,borderRadius:8,
                        border:`1.5px solid ${log.status===st.id?st.color:BORDER2}`,
                        background:log.status===st.id?`${st.color}20`:SURFACE,
                        color:log.status===st.id?st.color:MUTED,
                        cursor:"pointer",fontSize:12,fontWeight:700,
                        display:"flex",alignItems:"center",justifyContent:"center"
                      }}>{st.icon}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:MUTED,fontWeight:600,marginBottom:8}}>NOTES (optional)</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="PRs hit, how joints felt, anything notable..."
          rows={2} style={{width:"100%",background:BG,border:`1px solid ${BORDER2}`,borderRadius:10,padding:"10px 14px",color:TEXT,fontFamily:FB,fontSize:13,outline:"none",resize:"none",lineHeight:1.6}}/>
      </div>

      <button disabled={!effort||!feel} onClick={()=>{
        // Save per-exercise logs
        slots.forEach((s,i)=>{
          const id = exId(s, i);
          const log = slotLogs[id]||{};
          saveExerciseLog(id, {
            exerciseName: s.exerciseName||s.exercise,
            prescribed: {sets:s.sets, reps:s.reps},
            actual: {reps:log.actualReps, weight:log.weight},
            effort: log.effort||effort,
            status: log.status||"done",
            trackingMode: chosenMode,
          });
        });
        // Save session
        saveSession({
          track: track.id,
          duration,
          slots: slots.map(s=>s.exerciseName||s.exercise),
          overallEffort: effort,
          overallFeel: feel,
          notes: note,
          mode: chosenMode,
          slotLogs,
        });
        setStep("saved");
        setTimeout(onDone, 2000);
      }} style={{
        width:"100%",padding:"14px",borderRadius:12,border:"none",
        background:effort&&feel?C:FAINT,
        color:effort&&feel?BG:MUTED,
        fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.06em",
        cursor:effort&&feel?"pointer":"not-allowed",transition:"all 0.2s"
      }}>LOG SESSION ✓</button>
    </div>
  );

  // ── Saved confirmation ──
  if (step === "saved") {
    // Count partials/skips for adaptive message
    const partials = Object.values(slotLogs).filter(l=>l.status==="partial"||l.status==="skipped");
    const easy = effort===1;
    return (
      <div style={{padding:"24px",borderRadius:16,background:`${C}10`,border:`1px solid ${C}30`,textAlign:"center",animation:"pop 0.3s ease"}}>
        <div style={{fontSize:40,marginBottom:10}}>✅</div>
        <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:C,marginBottom:8}}>LOGGED. SEE YOU NEXT SESSION.</div>
        {partials.length>0&&(
          <div style={{fontSize:13,color:MUTED,lineHeight:1.6,marginTop:8,padding:"10px 14px",borderRadius:10,background:FAINT}}>
            💡 {partials.length} exercise{partials.length>1?"s were":" was"} flagged — your next protocol will adapt automatically.
          </div>
        )}
        {easy&&(
          <div style={{fontSize:13,color:MUTED,lineHeight:1.6,marginTop:8,padding:"10px 14px",borderRadius:10,background:FAINT}}>
            ⚡ Felt easy? Next session will push harder.
          </div>
        )}
      </div>
    );
  }

  return null;
}

function ProtocolScreen({ user, onBack }) {
  const [phase, setPhase] = useState("selecting");
  const [selectedTrack, setSelectedTrack] = useState(user.track);
  const [protocol, setProtocol] = useState(null);
  const [enriched, setEnriched] = useState(null);
  const [slotOverrides, setSlotOverrides] = useState({});
  const [loadLabel, setLoadLabel] = useState("");
  const [completedSlots, setCompletedSlots] = useState([]);
  const [error, setError] = useState(null);
  const [showRecap, setShowRecap] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showNutritionPrompt, setShowNutritionPrompt] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [restTimer, setRestTimer] = useState(null); // {secs, total} or null
  const timerRef = useRef(null);
  const restRef = useRef(null);
  const track = TRACKS[selectedTrack];

  // Elapsed stopwatch tick
  useEffect(() => {
    if (sessionStartTime) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-sessionStartTime)/1000)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionStartTime]);

  // Rest countdown tick
  useEffect(() => {
    if (restTimer && restTimer.secs > 0) {
      restRef.current = setTimeout(() => setRestTimer(r => r ? {...r, secs: r.secs-1} : null), 1000);
    } else if (restTimer && restTimer.secs === 0) {
      setRestTimer(null);
    }
    return () => clearTimeout(restRef.current);
  }, [restTimer]);

  const startRestTimer = (secs=60) => setRestTimer({secs, total:secs});
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const runProtocol = async () => {
    setPhase("loading");
    const proto = generateProtocol(selectedTrack, user.fxScores, user.loadout, user.limiters, user.ageTier, user.ageOverride);
    setProtocol(proto);
    const tierLabel = user.ageTier && !user.ageOverride ? ` (capped at ${user.ageTier.tierCap})` : "";
    const labels = [
      "Scanning loadout…",
      user.limiters?.length ? `Applying ${user.limiters.length} limiter${user.limiters.length>1?"s":""}…` : "No limiters active…",
      user.ageTier && !user.ageOverride ? `${user.ageTier.label} age defaults applying…` : "Age override active — full library…",
      `Tier ${proto.tier}/10${tierLabel} confirmed…`,
      ...track.blueprint.map(s=>`Locking ${s} pattern…`),
      "AI enriching protocol…","Ready."
    ];
    for (let l of labels) { setLoadLabel(l); await new Promise(r=>setTimeout(r,360)); }

    try {
      const ageMod = !user.ageOverride && user.ageTier ? AGE_VOLUME_MODS[user.ageTier.id] : AGE_VOLUME_MODS.PRIME;
      const slotList = proto.slots.map((s,i)=>
        `Slot ${i+1} [${s.slotType}]: ${s.exercise.name} — ${s.sets} × ${s.reps}`
      ).join("\n");

      const ageInstructions = user.ageTier && !user.ageOverride && user.ageTier.id !== "PRIME" ? `
AGE-AWARE VOLUME RULES (apply to every slot):
- Rest bonus: add ${ageMod.restBonus}s to all rest periods
- Tempo: ${ageMod.tempoNote || "standard"}
- Intensity: ${ageMod.intensityNote || "standard"}
- Progression style: ${ageMod.progressionStyle} — ${
  ageMod.progressionStyle === "gradual" ? "small weekly increments, no forced PRs" :
  ageMod.progressionStyle === "maintenance" ? "maintain quality and consistency over load increases" :
  ageMod.progressionStyle === "conservative" ? "add load only when all sets feel easy for 2+ sessions" :
  "standard progressive overload"
}
- Coaching cues must emphasise joint protection, controlled range of motion, and breath patterns
- Scaling options should be genuinely lower-impact (seated, supported, reduced ROM) not just lighter weight
- Warmup must include joint mobility work appropriate for age ${user.age}` : "";

      const body = JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:1400,messages:[{role:"user",content:`You are FitForge's Protocol Engine AI. Return ONLY valid JSON, no markdown.

Athlete: ${user.name} | Age: ${user.age || "not specified"} | Age Tier: ${user.ageTier?.label || "Prime"} | Track: ${track.name} | Tier: ${proto.tier}/10
FX: Drive ${user.fxScores.fx_drive} · Burst ${user.fxScores.fx_burst} · Engine ${user.fxScores.fx_engine} · Range ${user.fxScores.fx_range} · Form ${user.fxScores.fx_form}
Active limiters: ${user.limiters?.length ? user.limiters.join(", ") : "none"}
Age override: ${user.ageOverride ? "yes — full library, standard programming" : "no — age defaults active"}
${ageInstructions}
Slots (locked — do not change exercises):
${slotList}

For each slot: resolve any set/rep ranges to a SINGLE specific number (e.g. "3–4" → "3" or "4", never keep a range). Use the sets/reps provided above as a guide. Add rest seconds (include age rest bonus if applicable), write a cue (12 words max), a progressionTip (${ageMod.progressionStyle || "standard"} style), and a scalingOption (lower-impact for this age tier).
Also: creative sessionTitle, protocolNote (2 sentences reflecting age tier appropriately), 3-exercise warmup [{name,duration,cue}] (joint mobility first for 50+), 2 cooldown [{name,duration}], estimatedDuration.

JSON: {"sessionTitle":"","protocolNote":"","warmup":[{"name":"","duration":"","cue":""}],"slots":[{"slotType":"","exerciseName":"","sets":"","reps":"","rest":60,"cue":"","progressionTip":"","scalingOption":""}],"cooldown":[{"name":"","duration":""}],"estimatedDuration":""}`}]});

      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_KEY||"","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body});
      const data = await res.json();
      const text = data.content?.map(c=>c.text||"").join("") || "";
      setEnriched(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setError("AI enrichment unavailable — showing base protocol."); }

    setPhase("active");
  };

  if (phase==="selecting") return (
    <div style={{padding:"24px 22px 0"}}>
      <button onClick={onBack} style={{background:"transparent",border:`1px solid ${BORDER2}`,borderRadius:10,padding:"7px 14px",color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13,marginBottom:24}}>← Home</button>
      <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>SELECT PROTOCOL</div>
      <h2 style={{fontFamily:FD,fontSize:36,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:10}}>Choose today's<br/><span style={{color:GOLD}}>track, {user.name}.</span></h2>
      <p style={{color:MUTED,fontSize:13,lineHeight:1.7,marginBottom:24}}>Your FX profile and loadout are loaded. Select a track and the engine fires.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
        {Object.values(TRACKS).map(t=>(
          <button key={t.id} onClick={()=>setSelectedTrack(t.id)} style={{
            padding:"18px 20px",borderRadius:18,textAlign:"left",
            border:`2px solid ${selectedTrack===t.id?t.color:BORDER2}`,
            background:selectedTrack===t.id?t.colorDim:SURFACE,
            cursor:"pointer",fontFamily:FB,transition:"all 0.2s"
          }}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontFamily:FD,fontSize:26,fontWeight:800,letterSpacing:"0.04em",color:selectedTrack===t.id?t.color:TEXT}}>{t.icon} {t.name}</div>
              {selectedTrack===t.id&&<span style={{color:t.color,fontSize:16}}>✓</span>}
            </div>
            <div style={{fontSize:11,color:t.color,fontWeight:600,marginBottom:8}}>{t.tagline}</div>
            <div style={{display:"flex",gap:5}}>
              {t.blueprint.map((s,i)=><span key={i} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:`${SLOT_COLORS[s]}15`,color:SLOT_COLORS[s],fontWeight:800}}>{s}</span>)}
            </div>
            {t.id===user.track&&<div style={{marginTop:8,fontSize:11,color:GOLD,fontWeight:600}}>★ Your primary track</div>}
          </button>
        ))}
      </div>
      <button onClick={runProtocol} style={{width:"100%",padding:"17px",borderRadius:14,border:"none",background:track.gradient,color:BG,fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",cursor:"pointer",boxShadow:`0 6px 28px ${track.color}30`}}>
        GENERATE PROTOCOL →
      </button>
    </div>
  );

  if (phase==="loading") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",gap:24,padding:40}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
      <div style={{position:"relative",width:72,height:72}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid ${track.color}25`,borderTopColor:track.color,animation:"spin 0.9s linear infinite"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{track.icon}</div>
      </div>
      <div style={{fontFamily:FD,fontSize:30,fontWeight:800,letterSpacing:"0.06em",color:track.color}}>{track.name}</div>
      <div style={{fontSize:12,color:MUTED,letterSpacing:"0.08em",animation:"blink 1.5s ease infinite",textAlign:"center",minHeight:20}}>{loadLabel}</div>
      <div style={{display:"flex",gap:7}}>
        {track.blueprint.map((s,i)=><div key={i} style={{width:32,height:32,borderRadius:8,background:`${SLOT_COLORS[s]}15`,border:`1px solid ${SLOT_COLORS[s]}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:SLOT_COLORS[s],fontWeight:800}}>{s.slice(0,3)}</div>)}
      </div>
    </div>
  );

  if (phase==="active" && protocol) {
    const ageMod = !user.ageOverride && user.ageTier ? AGE_VOLUME_MODS[user.ageTier.id] : null;
    const baseSlots = enriched?.slots || protocol.slots.map(s=>({
      slotType:s.slotType,
      exerciseName:s.exercise.name,
      sets: s.sets || s.exercise.sets,
      reps: s.reps || s.exercise.reps,
      rest: 60 + (ageMod?.restBonus || 0),
      cue: s.exercise.cue,
      progressionTip: ageMod?.progressionStyle === "maintenance"
        ? "Maintain quality and consistency — load increase is optional"
        : ageMod?.progressionStyle === "gradual"
        ? "Add 1 rep or 2.5kg only when all sets feel easy for 2 sessions"
        : "Increase reps or load next session",
      scalingOption:"Reduce range of motion or resistance"
    }));
    const slots = baseSlots.map((s, i) => slotOverrides[i] ? { ...s, ...slotOverrides[i] } : s);

    const swapExercise = (slotIdx) => {
      const slot = slots[slotIdx];
      const slotType = slot.slotType;
      const protoSlot = protocol.slots[slotIdx];
      const tier = protoSlot?.exercise?.tier || 5;
      const usedNames = slots.map(s => s.exerciseName);
      const candidates = EXERCISES.filter(ex =>
        ex.slot === slotType &&
        ex.name !== slot.exerciseName &&
        !usedNames.includes(ex.name) &&
        (ex.equipment.length === 0 || ex.equipment.some(eq => user.loadout?.includes(eq))) &&
        !ex.limitedBy?.some(l => user.limiters?.includes(l)) &&
        (!user.ageTier || user.ageOverride || !user.ageTier.excludedIds.includes(ex.id))
      );
      if (!candidates.length) return;
      const sorted = [...candidates].sort((a,b) => Math.abs(a.tier-tier) - Math.abs(b.tier-tier));
      const pick = sorted.slice(0,3)[Math.floor(Math.random()*Math.min(3,sorted.length))];
      const { sets, reps } = applyAgeMod(pick, user.ageTier, user.ageOverride);
      setSlotOverrides(prev => ({
        ...prev,
        [slotIdx]: { exerciseName: pick.name, sets, reps, cue: pick.cue, progressionTip: "Increase reps or load next session", scalingOption: "Reduce range of motion or resistance" }
      }));
    };
    const warmup = enriched?.warmup||[];
    const cooldown = enriched?.cooldown||[];

    return (
      <div style={{padding:"20px 22px 0",animation:"fadeIn 0.4s ease"}}>
        <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontSize:10,color:track.color,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>{track.icon} {track.name} · TIER {protocol.tier}/10</div>
            <h2 style={{fontFamily:FD,fontSize:26,fontWeight:800,letterSpacing:"0.02em",color:TEXT,lineHeight:1.1}}>{enriched?.sessionTitle||`${track.name} Protocol`}</h2>
          </div>
          <button onClick={()=>setPhase("selecting")} style={{background:"transparent",border:`1px solid ${BORDER2}`,borderRadius:10,padding:"7px 12px",color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:12,flexShrink:0,marginLeft:12}}>↺</button>
        </div>

        {/* START WORKOUT CTA — shows when session not yet started */}
        {!sessionStartTime && completedSlots.length===0 && (
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button onClick={()=>setSessionStartTime(Date.now())} style={{
              flex:1,padding:"16px",borderRadius:14,border:"none",
              background:`linear-gradient(135deg,${track.color},${track.color}AA)`,
              color:BG,fontFamily:FD,fontSize:20,fontWeight:800,letterSpacing:"0.08em",
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              boxShadow:`0 4px 20px ${track.color}30`
            }}>
              ▶ START SESSION
            </button>
            <button onClick={()=>setShowTimer(true)} style={{
              padding:"16px 18px",borderRadius:14,
              background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.12)`,
              color:TEXT,fontFamily:FD,fontSize:22,fontWeight:800,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              flexShrink:0
            }} title="Interval Timer">
              ⏱
            </button>
          </div>
        )}
        {sessionStartTime && completedSlots.length<slots.length && (
          <div style={{marginBottom:16}}>
            {/* Stopwatch bar */}
            <div style={{padding:"12px 16px",borderRadius:12,background:`${track.color}10`,border:`1px solid ${track.color}25`,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:track.color,animation:"pulse 1.5s infinite"}}/>
                <div style={{fontSize:12,color:track.color,fontWeight:700,letterSpacing:"0.08em"}}>LIVE</div>
              </div>
              <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:TEXT,letterSpacing:"0.06em"}}>{fmt(elapsed)}</div>
              <button onClick={()=>setShowTimer(true)} style={{
                padding:"6px 12px",borderRadius:9,
                background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                color:MUTED,cursor:"pointer",fontFamily:FD,fontSize:13,fontWeight:700
              }}>⏱ TIMER</button>
            </div>
            {/* Rest timer */}
            {restTimer ? (
              <div style={{padding:"12px 16px",borderRadius:12,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.3)",display:"flex",justifyContent:"space-between",alignItems:"center",animation:"fadeUp 0.2s ease"}}>
                <div>
                  <div style={{fontSize:10,color:"#34D399",fontWeight:700,letterSpacing:"0.1em"}}>REST</div>
                  <div style={{fontFamily:FD,fontSize:32,fontWeight:800,color:"#34D399"}}>{fmt(restTimer.secs)}</div>
                </div>
                <div style={{flex:1,margin:"0 16px",height:6,borderRadius:3,background:FAINT,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(restTimer.secs/restTimer.total)*100}%`,background:"#34D399",borderRadius:3,transition:"width 1s linear"}}/>
                </div>
                <button onClick={()=>setRestTimer(null)} style={{padding:"8px 14px",borderRadius:9,background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.3)",color:"#34D399",cursor:"pointer",fontFamily:FD,fontSize:14,fontWeight:800}}>SKIP</button>
              </div>
            ) : (
              <button onClick={()=>startRestTimer(60)} style={{width:"100%",padding:"10px",borderRadius:11,background:SURFACE,border:`1px solid ${BORDER2}`,color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:13,fontWeight:600,letterSpacing:"0.04em"}}>
                ⏱ Start 60s rest timer
              </button>
            )}
          </div>
        )}

        {error&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",marginBottom:14,fontSize:12,color:"#F87171"}}>{error}</div>}

        {/* Active constraint chips */}
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
          {user.ageTier && user.ageTier.id!=="PRIME" && (
            <div style={{padding:"4px 10px",borderRadius:8,background:`${user.ageTier.color}12`,border:`1px solid ${user.ageTier.color}30`,fontSize:11,color:user.ageTier.color,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
              {user.ageTier.icon} {user.ageTier.label}
              {user.ageOverride
                ? <span style={{fontWeight:400,color:MUTED}}> · Override</span>
                : <span style={{fontWeight:400,color:MUTED}}> · Cap {user.ageTier.tierCap}/10</span>}
            </div>
          )}
          {user.limiters?.map(l=>(
            <div key={l} style={{padding:"4px 10px",borderRadius:8,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",fontSize:11,color:"#F87171",fontWeight:600,textTransform:"capitalize"}}>
              🔴 {l.replace("_"," ")}
            </div>
          ))}
          {(!user.limiters?.length && (!user.ageTier || user.ageTier.id==="PRIME")) && (
            <div style={{padding:"4px 10px",borderRadius:8,background:FAINT,fontSize:11,color:MUTED}}>No active constraints</div>
          )}
        </div>

        {enriched?.protocolNote&&(
          <div style={{padding:"13px 16px",borderRadius:13,background:track.colorDim,border:`1px solid ${track.color}20`,marginBottom:16}}>
            <div style={{fontSize:10,color:track.color,fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>PROTOCOL NOTE</div>
            <p style={{fontSize:13,color:MUTED,lineHeight:1.65,margin:0}}>{enriched.protocolNote}</p>
          </div>
        )}

        {/* Age volume mod banner — Masters / Elite Masters */}
        {ageMod && ageMod.tempoNote && (
          <div style={{padding:"12px 14px",borderRadius:13,background:`${user.ageTier.color}0C`,border:`1px solid ${user.ageTier.color}25`,marginBottom:16}}>
            <div style={{fontSize:10,color:user.ageTier.color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>
              {user.ageTier.icon} {user.ageTier.label} PROTOCOL RULES
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.5}}>⏱ <span style={{color:TEXT,fontWeight:600}}>Tempo:</span> {ageMod.tempoNote}</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.5}}>🎯 <span style={{color:TEXT,fontWeight:600}}>Intensity:</span> {ageMod.intensityNote}</div>
              <div style={{fontSize:12,color:MUTED,lineHeight:1.5}}>🔄 <span style={{color:TEXT,fontWeight:600}}>Progression:</span> {
                ageMod.progressionStyle==="maintenance" ? "Maintain quality first — load increase is optional" :
                ageMod.progressionStyle==="gradual" ? "Add load only after 2 sessions feel easy" :
                "Conservative load increases, joint health priority"
              }</div>
              {ageMod.restBonus > 0 && <div style={{fontSize:12,color:MUTED}}>⏸ <span style={{color:TEXT,fontWeight:600}}>Rest:</span> +{ageMod.restBonus}s added to all rest periods</div>}
            </div>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,color:MUTED}}>{completedSlots.length}/{slots.length} complete</div>
          <div style={{fontSize:12,color:track.color,fontWeight:700}}>{enriched?.estimatedDuration||"~45 min"}</div>
        </div>
        <div style={{height:3,background:FAINT,borderRadius:2,overflow:"hidden",marginBottom:20}}>
          <div style={{height:"100%",width:`${(completedSlots.length/slots.length)*100}%`,background:track.color,borderRadius:2,transition:"width 0.4s ease"}}/>
        </div>

        {warmup.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>WARM-UP</div>
            {warmup.map((w,i)=>(
              <div key={i} style={{padding:"10px 14px",borderRadius:10,background:SURFACE,border:`1px solid ${BORDER}`,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{w.name}</span>
                  {w.cue&&<div style={{fontSize:11,color:MUTED,marginTop:2}}>{w.cue}</div>}
                </div>
                <span style={{fontSize:12,color:MUTED,flexShrink:0,marginLeft:10}}>{w.duration}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>6-SLOT PROTOCOL</div>
        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:22}}>
          {slots.map((s,i)=>{
            const done=completedSlots.includes(i);
            const sc=SLOT_COLORS[s.slotType];
            return (
              <div key={i} onClick={()=>{
                const nowDone = completedSlots.includes(i);
                setCompletedSlots(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i]);
                if (!nowDone && sessionStartTime) startRestTimer(slots[i]?.rest||60);
              }} style={{
                borderRadius:16,background:done?`${sc}07`:SURFACE,
                border:`1.5px solid ${done?sc+"50":BORDER2}`,
                cursor:"pointer",overflow:"hidden",transition:"all 0.2s",opacity:done?.65:1
              }}>
                <div style={{height:3,background:done?sc:`${sc}25`}}/>
                <div style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",gap:7,alignItems:"center"}}>
                      <span style={{fontSize:9,padding:"3px 8px",borderRadius:5,background:`${sc}18`,color:sc,fontWeight:800,letterSpacing:"0.07em"}}>{s.slotType}</span>
                      <span style={{fontSize:10,color:MUTED}}>Slot {i+1}</span>
                    </div>
                    <div style={{width:20,height:20,borderRadius:"50%",border:`1.5px solid ${done?sc:BORDER2}`,background:done?sc:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:done?BG:MUTED,transition:"all 0.2s",flexShrink:0}}>
                      {done?"✓":""}
                    </div>
                  </div>
                  <div style={{fontFamily:FD,fontSize:21,fontWeight:800,letterSpacing:"0.02em",color:done?MUTED:TEXT,marginBottom:4}}>{s.exerciseName}</div>
                  <div style={{fontSize:13,color:sc,fontWeight:700,marginBottom:s.cue?6:0}}>{resolveRange(s.sets)} × {s.reps} · {s.rest}s rest</div>
                  {s.cue&&!done&&<div style={{fontSize:12,color:MUTED,lineHeight:1.55,marginBottom:s.progressionTip?4:0}}>💡 {s.cue}</div>}
                  {s.progressionTip&&!done&&<div style={{fontSize:11,color:`${sc}80`,fontStyle:"italic"}}>→ {s.progressionTip}</div>}
                  {!done&&(()=>{
                    const id=slugify(s.exerciseName||"");
                    const nudge=getNudge(id,{reps:s.reps,sets:s.sets});
                    if(!nudge) return null;
                    const nc=nudge.type==="push"?"#34D399":sc;
                    return (<div style={{marginTop:8,padding:"8px 10px",borderRadius:9,background:`${nc}10`,border:`1px solid ${nc}25`,display:"flex",gap:7,alignItems:"flex-start"}}><span style={{fontSize:13,flexShrink:0}}>{nudge.icon}</span><span style={{fontSize:11,color:nc,lineHeight:1.5,fontWeight:600}}>{nudge.text}</span></div>);
                  })()}
                  {/* Action buttons row */}
                  {!done&&(
                    <div style={{marginTop:8,display:"flex",gap:6}}>
                      <div style={{
                        display:"inline-flex",alignItems:"center",gap:5,
                        padding:"5px 12px",borderRadius:8,
                        background:"rgba(255,255,255,0.03)",
                        border:"1px solid rgba(255,255,255,0.06)",
                        color:"rgba(238,242,248,0.2)",
                        fontSize:11,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",
                        letterSpacing:"0.08em",cursor:"default",userSelect:"none"
                      }}>
                        ▶ DEMO COMING SOON
                      </div>
                      <button
                        onClick={e=>{ e.stopPropagation(); swapExercise(i); }}
                        style={{
                          display:"inline-flex",alignItems:"center",gap:4,
                          padding:"5px 12px",borderRadius:8,
                          background:`${sc}10`,border:`1px solid ${sc}30`,
                          color:sc,fontSize:11,fontWeight:700,
                          fontFamily:"'Barlow Condensed',sans-serif",
                          letterSpacing:"0.08em",cursor:"pointer"
                        }}
                      >
                        ⇄ SWAP
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cooldown.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>COOL-DOWN</div>
            {cooldown.map((c,i)=>(
              <div key={i} style={{padding:"10px 14px",borderRadius:10,background:SURFACE,border:`1px solid ${BORDER}`,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{c.name}</span>
                <span style={{fontSize:12,color:MUTED}}>{c.duration}</span>
              </div>
            ))}
          </div>
        )}

        {completedSlots.length===slots.length&&(
          <div style={{padding:"22px",borderRadius:16,background:`${track.color}10`,border:`1px solid ${track.color}30`,textAlign:"center",marginBottom:24,animation:"pop 0.4s ease"}}>
            <div style={{fontSize:44,marginBottom:10}}>🏁</div>
            <div style={{fontFamily:FD,fontSize:26,fontWeight:800,color:track.color,letterSpacing:"0.04em",marginBottom:4}}>PROTOCOL COMPLETE</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:16}}>All {slots.length} slots locked.</div>
            <button onClick={()=>setShowRecap(true)} style={{
              padding:"14px 28px",borderRadius:12,border:"none",
              background:track.color,color:BG,
              fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.06em",
              cursor:"pointer",boxShadow:`0 4px 16px ${track.color}40`
            }}>VIEW SESSION RECAP →</button>
          </div>
        )}

        {/* INTERVAL TIMER OVERLAY */}
        {showTimer && (
          <IntervalTimer
            slots={(enriched?.slots||protocol?.slots||[]).map(s=>({
              exercise: s.exercise?.name || s.exercise || s.exerciseName || s.name || "",
              exerciseName: s.exercise?.name || s.exercise || s.exerciseName || s.name || "",
              slotType: s.slotType || s.exercise?.slot || "",
              sets: s.sets,
              reps: s.reps,
            }))}
            trackId={selectedTrack||"FORGE"}
            trackColor={track?.color||"#F0C060"}
            trackName={`${track?.name||selectedTrack||"SESSION"} PROTOCOL`}
            onClose={()=>setShowTimer(false)}
            onComplete={()=>{
              // Mark all slots complete and trigger recap
              setShowTimer(false);
              setCompletedSlots(slots.map((_,i)=>i));
              if (!sessionStartTime) setSessionStartTime(Date.now() - 1000);
              setShowRecap(true);
            }}
          />
        )}

        {/* SESSION RECAP MODAL */}
        {showRecap && (
          <div style={{position:"fixed",inset:0,background:"rgba(6,8,12,0.96)",zIndex:200,overflowY:"auto",padding:"28px 22px"}}>
            <div style={{maxWidth:500,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:28}}>
                <div style={{fontSize:52,marginBottom:10}}>🏆</div>
                <div style={{fontFamily:FD,fontSize:36,fontWeight:800,color:track.color,letterSpacing:"0.04em",marginBottom:4}}>SESSION DONE</div>
                <div style={{fontSize:14,color:MUTED}}>{enriched?.sessionTitle||`${track.name} Protocol`}</div>
              </div>

              {/* Stats row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
                {[
                  {label:"SLOTS",val:slots.length,unit:""},
                  {label:"DURATION",val:sessionStartTime?Math.round((Date.now()-sessionStartTime)/60000):"~45",unit:"min"},
                  {label:"TIER",val:protocol.tier,unit:"/10"},
                ].map(s=>(
                  <div key={s.label} style={{padding:"14px 10px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
                    <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:track.color,lineHeight:1}}>{s.val}<span style={{fontSize:14,color:MUTED}}>{s.unit}</span></div>
                    <div style={{fontSize:9,color:MUTED,fontWeight:700,letterSpacing:"0.1em",marginTop:4}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Slot summary */}
              <div style={{padding:"16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:16}}>
                <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",marginBottom:12}}>EXERCISES COMPLETED</div>
                {slots.map((s,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<slots.length-1?`1px solid ${BORDER}`:"none"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:`${SLOT_COLORS[s.slotType]}15`,color:SLOT_COLORS[s.slotType],fontWeight:800}}>{s.slotType}</span>
                      <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{s.exerciseName}</span>
                    </div>
                    <span style={{fontSize:11,color:MUTED}}>{resolveRange(s.sets)} × {s.reps}</span>
                  </div>
                ))}
              </div>

              {/* Post-workout nutrition prompt */}
              {!showNutritionPrompt ? (
                <button onClick={()=>setShowNutritionPrompt(true)} style={{width:"100%",padding:"12px",borderRadius:12,border:`1px solid ${track.color}40`,background:`${track.color}08`,color:track.color,fontFamily:FD,fontSize:14,fontWeight:800,letterSpacing:"0.06em",cursor:"pointer",marginBottom:12}}>
                  🍽 LOG POST-WORKOUT FUEL
                </button>
              ) : (
                <PostWorkoutNutritionPrompt
                  user={user}
                  targets={user?.weightKg ? calcTargets(calcTDEE(user.weightKg,user.heightCm||175,user.age||30,user.sex,3), user.track||"FORGE", user.goal||"maintain", false) : null}
                  onLog={()=>{ setShowRecap(false); setCompletedSlots([]); setSessionStartTime(null); setElapsed(0); setPhase("selecting"); }}
                  onDismiss={()=>setShowNutritionPrompt(false)}
                />
              )}

              {/* Post-session check-in */}
              <PostSessionCheckin
                track={track}
                slots={(enriched?.slots||protocol?.slots||[]).map(s=>({
                  exerciseName: s.exerciseName || s.exercise?.name || s.name || "",
                  exercise: s.exerciseName || s.exercise?.name || s.name || "",
                  sets: s.sets, reps: s.reps, slotType: s.slotType
                }))}
                duration={sessionStartTime?Math.round((Date.now()-sessionStartTime)/60000):0}
                onDone={()=>{ setShowRecap(false); setCompletedSlots([]); setSessionStartTime(null); setElapsed(0); setPhase("selecting"); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ─── FX PROFILE TAB ───────────────────────────────────────────────────────────
function FXProfileTab({ user }) {
  const track = TRACKS[user.track];
  return (
    <div style={{padding:"24px 22px 0"}}>
      <div style={{fontSize:10,color:GOLD,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>FORGE INDEX</div>
      <h2 style={{fontFamily:FD,fontSize:36,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:20}}>{user.name}'s<br/><span style={{color:GOLD}}>FX Profile.</span></h2>
      <div style={{display:"flex",justifyContent:"center",marginBottom:22}}><FXRadar scores={user.fxScores} size={190}/></div>
      <div style={{padding:"18px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`,marginBottom:18}}>
        {FX_AXES.map((ax,i)=><ScoreBar key={ax.id} score={user.fxScores[ax.id]||50} color={ax.color} label={`${ax.icon} ${ax.name}`} sublabel={ax.unit} delay={i*80}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div style={{padding:"16px",borderRadius:14,background:track.colorDim,border:`1px solid ${track.color}30`,textAlign:"center"}}>
          <div style={{fontSize:10,color:track.color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>ACTIVE TRACK</div>
          <div style={{fontFamily:FD,fontSize:22,fontWeight:800,color:track.color,letterSpacing:"0.04em"}}>{track.icon} {track.name}</div>
          <div style={{fontSize:11,color:MUTED,marginTop:4}}>{track.tagline}</div>
        </div>
        <div style={{padding:"16px",borderRadius:14,background:FAINT,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
          <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>PROTOCOL TIER</div>
          <div style={{fontFamily:FD,fontSize:46,fontWeight:800,color:TEXT,lineHeight:1}}>{getProtocolTier(user.fxScores,user.track)}<span style={{fontSize:18,color:MUTED}}>/10</span></div>
        </div>
      </div>
      {user.limiters?.length>0&&(
        <div style={{padding:"13px 16px",borderRadius:14,background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",marginBottom:12}}>
          <div style={{fontSize:10,color:"#F87171",fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>⬤ ACTIVE LIMITERS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {user.limiters.map(l=><span key={l} style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:"rgba(248,113,113,0.1)",color:"#F87171",fontWeight:600,textTransform:"capitalize"}}>{l.replace("_"," ")}</span>)}
          </div>
          {user.limiterText&&<p style={{fontSize:12,color:MUTED,marginTop:10,fontStyle:"italic"}}>"{user.limiterText}"</p>}
        </div>
      )}
      {user.ageTier && (
        <div style={{padding:"13px 16px",borderRadius:14,background:`${user.ageTier.color}0C`,border:`1px solid ${user.ageTier.color}25`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>{user.ageTier.icon}</span>
            <div>
              <div style={{fontSize:11,color:user.ageTier.color,fontWeight:700,letterSpacing:"0.08em"}}>{user.ageTier.label.toUpperCase()} · Age {user.age}</div>
              <div style={{fontSize:11,color:MUTED,marginTop:2,lineHeight:1.5}}>{user.ageTier.desc}</div>
            </div>
          </div>
          {user.ageOverride && <div style={{fontSize:11,color:"#34D399",fontWeight:700,background:"rgba(52,211,153,0.1)",padding:"4px 10px",borderRadius:8,flexShrink:0,marginLeft:10}}>OVERRIDE</div>}
        </div>
      )}
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ user, onNavigate }) {
  const track = TRACKS[user.track];
  const tier = getProtocolTier(user.fxScores, user.track);
  return (
    <div style={{padding:"24px 22px 0"}}>
      <div style={{marginBottom:26}}>
        <div style={{fontSize:12,color:MUTED,marginBottom:4,letterSpacing:"0.04em"}}>Welcome back,</div>
        <h1 style={{fontFamily:FD,fontSize:42,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,color:TEXT}}>{user.name}<span style={{color:track.color}}>.</span></h1>
      </div>

      <div onClick={()=>onNavigate("train")} style={{padding:"22px",borderRadius:20,marginBottom:18,cursor:"pointer",background:`linear-gradient(135deg,${track.color}14,${track.color}05)`,border:`1.5px solid ${track.color}35`,transition:"all 0.2s",boxShadow:`0 8px 40px ${track.color}12`}}
        onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 12px 50px ${track.color}22`;}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 8px 40px ${track.color}12`;}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{fontSize:10,color:track.color,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>ACTIVE TRACK</div>
            <div style={{fontFamily:FD,fontSize:32,fontWeight:800,letterSpacing:"0.04em",color:TEXT}}>{track.icon} {track.name}</div>
            <div style={{fontSize:12,color:track.color,fontWeight:600,marginTop:3}}>{track.tagline}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:FD,fontSize:52,fontWeight:800,color:track.color,lineHeight:1}}>{tier}</div>
            <div style={{fontSize:9,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase"}}>Tier</div>
          </div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:14}}>
          {track.blueprint.map((s,i)=><span key={i} style={{flex:1,padding:"5px 0",textAlign:"center",borderRadius:7,background:`${SLOT_COLORS[s]}15`,color:SLOT_COLORS[s],fontSize:9,fontWeight:800,letterSpacing:"0.04em"}}>{s}</span>)}
        </div>
        <div style={{padding:"12px 16px",borderRadius:12,background:track.color,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:FD,fontSize:15,fontWeight:800,letterSpacing:"0.08em",color:BG}}>GENERATE TODAY'S PROTOCOL</span>
          <span style={{color:BG,fontSize:16}}>→</span>
        </div>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>FX PROFILE</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
          {FX_AXES.map(ax=>(
            <div key={ax.id} style={{padding:"12px 6px",borderRadius:12,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
              <div style={{fontSize:15,marginBottom:4}}>{ax.icon}</div>
              <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:ax.color,lineHeight:1}}>{user.fxScores[ax.id]||50}</div>
              <div style={{fontSize:8,color:MUTED,marginTop:3,letterSpacing:"0.04em",textTransform:"uppercase"}}>{ax.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        {[
          {label:"Programs",icon:"📚",color:"#60A5FA",tab:"programs",desc:"Structured protocols"},
          {label:"Challenges",icon:"🔥",color:"#F87171",tab:"challenges",desc:"30-day commitments"},
          {label:"Gear Shop",icon:"🛒",color:GOLD,tab:"shop",desc:"Upgrade loadout"},
          {label:"FX Profile",icon:"📊",color:"#E879F9",tab:"fx",desc:"Your Forge Index"},
        ].map(a=>(
          <button key={a.tab} onClick={()=>onNavigate(a.tab)} style={{padding:"16px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,cursor:"pointer",fontFamily:FB,textAlign:"left",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color+"40";e.currentTarget.style.background=a.color+"08";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER2;e.currentTarget.style.background=SURFACE;}}>
            <div style={{fontSize:22,marginBottom:7}}>{a.icon}</div>
            <div style={{fontFamily:FD,fontSize:15,fontWeight:800,letterSpacing:"0.04em",color:TEXT,marginBottom:2}}>{a.label}</div>
            <div style={{fontSize:11,color:MUTED}}>{a.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
const NAV = [
  {id:"home",    label:"Home",      icon:({a,c})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a?c:"rgba(238,242,248,0.3)"} strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>},
  {id:"train",   label:"Train",     icon:({a,c})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a?c:"rgba(238,242,248,0.3)"} strokeWidth="2" strokeLinecap="round"><path d="M6 4v16M18 4v16M6 12h12M2 8h4M18 8h4M2 16h4M18 16h4"/></svg>},
  {id:"programs",label:"Programs",  icon:({a,c})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a?c:"rgba(238,242,248,0.3)"} strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},
  {id:"fx",      label:"FX Profile", icon:({a,c})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a?c:"rgba(238,242,248,0.3)"} strokeWidth="2" strokeLinecap="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>},
  {id:"food",    label:"Food",      icon:({a,c})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a?c:"rgba(238,242,248,0.3)"} strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>},
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [trainView, setTrainView] = useState("menu");
  const [healthData, setHealthData] = useState(null); // aggregated from all connected platforms

  if (!user) return <Onboarding onComplete={d=>{ setUser(d); }}/>;

  const track = TRACKS[user.track];
  const nav = (t) => { if(t==="train") setTrainView("menu"); setTab(t); };

  // Called by HealthConnectionsPanel when any platform syncs
  const handleHealthDataUpdate = (platformId, data) => {
    setHealthData(data); // use most recent sync as primary
    // Auto-update weight if synced
    if (data.weight && !user.weightKg) {
      setUser(u => ({ ...u, weightKg: data.weight }));
    }
  };

  const content = () => {
    if (tab==="home") return <HomeTab user={user} onNavigate={nav}/>;
    if (tab==="fx")   return <FXProfileTab user={user}/>;

    if (tab==="train") {
      if (trainView==="protocol") return <ProtocolScreen user={user} onBack={()=>setTrainView("menu")}/>;
      return (
        <div style={{padding:"24px 22px 0"}}>
          <div style={{fontSize:10,color:track.color,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:14}}>TRAIN</div>
          <h2 style={{fontFamily:FD,fontSize:36,fontWeight:800,letterSpacing:"0.02em",lineHeight:.95,marginBottom:10}}>Ready to<br/><span style={{color:track.color}}>build, {user.name}?</span></h2>

          {/* Recovery banner — shown when health platform connected */}
          {healthData && (
            <div style={{marginBottom:16}}>
              {/* Inline recovery context */}
              {(()=>{
                const sleep = healthData.sleep;
                const hrv = healthData.hrv;
                const restingHR = healthData.hr_resting;
                const flags = [];
                if (sleep?.durationHours < 6) flags.push({text:`${sleep.durationHours}h sleep — consider scaling today`,color:"#FB923C",icon:"🌙"});
                else if (sleep?.durationHours >= 8) flags.push({text:`Well rested (${sleep.durationHours}h) — optimal session conditions`,color:"#34D399",icon:"✨"});
                if (hrv && hrv < 30) flags.push({text:`Low HRV (${hrv}ms) — nervous system stressed`,color:"#F87171",icon:"📉"});
                if (restingHR && restingHR > 72) flags.push({text:`Elevated resting HR (${restingHR}bpm) — possible fatigue`,color:"#FB923C",icon:"❤️"});
                if (flags.length === 0) return null;
                const topFlag = flags[0];
                return (
                  <div style={{padding:"12px 14px",borderRadius:12,background:`${topFlag.color}0C`,border:`1px solid ${topFlag.color}25`,marginBottom:16}}>
                    <div style={{fontSize:11,color:topFlag.color,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:flags.length>1?6:0}}>
                      ⌚ RECOVERY CONTEXT
                    </div>
                    {flags.map((f,i)=><div key={i} style={{fontSize:12,color:f.color,lineHeight:1.5,marginTop:i>0?3:4}}>{f.icon} {f.text}</div>)}
                  </div>
                );
              })()}
            </div>
          )}

          <p style={{color:MUTED,fontSize:14,lineHeight:1.7,marginBottom:24}}>The Protocol Engine builds your 6-slot session using your loadout, limiters, and FX scores.</p>
          <button onClick={()=>setTrainView("protocol")} style={{width:"100%",padding:"22px 20px",borderRadius:18,border:"none",background:track.gradient,color:BG,fontFamily:FD,fontSize:22,fontWeight:800,letterSpacing:"0.06em",cursor:"pointer",marginBottom:16,boxShadow:`0 8px 32px ${track.color}28`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",opacity:.7,marginBottom:4}}>TODAY'S SESSION</div>
              GENERATE PROTOCOL →
            </div>
            <span style={{fontSize:40}}>{track.icon}</span>
          </button>
          <div style={{padding:"16px",borderRadius:16,background:SURFACE,border:`1px solid ${BORDER2}`}}>
            <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>TODAY'S BLUEPRINT</div>
            {track.blueprint.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:12,alignItems:"center",paddingBottom:10,marginBottom:i<5?10:0,borderBottom:i<5?`1px solid ${BORDER}`:"none"}}>
                <div style={{width:34,height:34,borderRadius:8,background:`${SLOT_COLORS[s]}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:SLOT_COLORS[s],fontWeight:800,flexShrink:0}}>{s.slice(0,3)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT}}>Slot {i+1} · {s}</div>
                  <div style={{fontSize:11,color:MUTED}}>Filtered to loadout · Tier {getProtocolTier(user.fxScores,user.track)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (tab==="programs") return (
      <ProgramsTab
        user={user}
        onNavigateToTrain={(trackOverride) => {
          if (trackOverride) {
            // TODO: pass track override into ProtocolScreen when needed
          }
          nav("train");
        }}
      />
    );

    // Food tab — import FoodTrackerTab from ./FoodTracker in your Vite project
    // then replace this placeholder with: <FoodTrackerTab user={user} sessionCaloriesBurned={lastSessionCalories}/>
    if (tab==="food") return (
      <FoodTrackerTab user={user}/>
    );

    if (tab==="settings") return (
      <HealthConnectionsPanel user={user} onDataUpdate={handleHealthDataUpdate}/>
    );
  };

  return (
    <div style={{background:BG,minHeight:"100vh",fontFamily:FB,color:TEXT}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:2px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07)}
        button{-webkit-tap-highlight-color:transparent}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Top bar */}
      <div style={{position:"sticky",top:0,zIndex:50,background:`${BG}EE`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${BORDER}`,padding:"13px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:520,margin:"0 auto",width:"100%"}}>
        <div style={{fontFamily:FD,fontWeight:800,fontSize:22,letterSpacing:"0.1em",color:TEXT}}>FIT<span style={{color:track.color}}>FORGE</span></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",fontWeight:600}}>{track.icon} {track.name}</div>
          <div style={{width:30,height:30,borderRadius:"50%",background:track.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FD,fontSize:14,fontWeight:800,color:BG}}>{user.name[0].toUpperCase()}</div>
        </div>
      </div>

      {/* Content */}
      <div key={tab} style={{maxWidth:520,margin:"0 auto",paddingBottom:90,animation:"fadeIn 0.2s ease"}}>
        {content()}
      </div>

      {/* Floating mic button */}
      <FloatingMicButton user={user} onLogSaved={()=>{}} onOpenFood={()=>nav("food")} />

      {/* Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:`${BG}F2`,backdropFilter:"blur(24px)",borderTop:`1px solid ${BORDER}`,padding:"10px 0 max(10px,env(safe-area-inset-bottom))"}}>
        <div style={{maxWidth:520,margin:"0 auto",display:"flex",justifyContent:"space-around"}}>
          {NAV.map(t=>{
            const active=tab===t.id;
            const Icon=t.icon;
            return (
              <button key={t.id} onClick={()=>nav(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"transparent",border:"none",cursor:"pointer",padding:"4px 14px",fontFamily:FB,transition:"all 0.15s"}}>
                <div style={{transform:active?"translateY(-1px)":"none",transition:"transform 0.15s"}}>
                  <Icon a={active} c={track.color}/>
                </div>
                <span style={{fontSize:9,fontWeight:active?700:500,color:active?track.color:"rgba(238,242,248,0.28)",letterSpacing:"0.04em",textTransform:"uppercase"}}>{t.label}</span>
                {active&&<div style={{width:14,height:2,borderRadius:1,background:track.color,marginTop:-2}}/>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
