import { useState, useEffect, useRef } from "react";

// ─── SLOT CONFIG ──────────────────────────────────────────────────────────────
const SLOT_COLORS = {
  PUSH:"#F87171", PULL:"#60A5FA", SQUAT:"#34D399", HINGE:"#FBBF24",
  CORE:"#A78BFA", LUNGE:"#F472B6", METCON:"#FB923C",
};

// ─── CSS ANIMATIONS ───────────────────────────────────────────────────────────
const ANIM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;600;700&display=swap');

  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

  /* PUSH — press down and up */
  @keyframes push-body { 0%,100%{transform:translateY(0)} 50%{transform:translateY(18px)} }
  @keyframes push-arms { 0%,100%{transform:scaleY(1) translateY(0)} 50%{transform:scaleY(0.4) translateY(8px)} }

  /* PULL — row / pull movement */
  @keyframes pull-torso { 0%,100%{transform:rotate(40deg)} 50%{transform:rotate(10deg)} }
  @keyframes pull-arms  { 0%,100%{transform:translateX(20px)} 50%{transform:translateX(-8px)} }

  /* SQUAT — sit and stand */
  @keyframes squat-body { 0%,100%{transform:translateY(0) scaleY(1)} 50%{transform:translateY(22px) scaleY(0.78)} }
  @keyframes squat-legs { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(35deg)} }

  /* HINGE — hip hinge */
  @keyframes hinge-torso { 0%,100%{transform:rotate(0deg) translateY(0)} 50%{transform:rotate(70deg) translateY(4px)} }
  @keyframes hinge-legs  { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.95)} }

  /* CORE — crunch / rotation */
  @keyframes core-upper { 0%,100%{transform:rotate(0deg) translateY(0)} 50%{transform:rotate(-35deg) translateY(-8px)} }
  @keyframes core-lower { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(20deg)} }

  /* LUNGE — step and return */
  @keyframes lunge-body   { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(12px) translateX(10px)} }
  @keyframes lunge-frontleg { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(50deg)} }
  @keyframes lunge-backleg  { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-30deg)} }

  /* METCON — jumping jack / burpee */
  @keyframes metcon-arms { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(140deg)} }
  @keyframes metcon-legs { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(35deg)} }
  @keyframes metcon-body { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-14px)} 60%{transform:translateY(0)} }
`;

// ─── SVG SILHOUETTE FIGURES ───────────────────────────────────────────────────
function PushFigure({ color }) {
  return (
    <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      {/* Head */}
      <circle cx="60" cy="18" r="12" fill={color} opacity="0.9"/>
      {/* Body moving up/down */}
      <g style={{transformOrigin:"60px 40px", animation:"push-body 1.4s ease-in-out infinite"}}>
        {/* Torso */}
        <rect x="50" y="32" width="20" height="30" rx="6" fill={color} opacity="0.85"/>
        {/* Arms */}
        <g style={{transformOrigin:"50px 40px", animation:"push-arms 1.4s ease-in-out infinite"}}>
          <rect x="20" y="38" width="30" height="8" rx="4" fill={color} opacity="0.75"/>
        </g>
        <g style={{transformOrigin:"70px 40px", animation:"push-arms 1.4s ease-in-out infinite"}}>
          <rect x="70" y="38" width="30" height="8" rx="4" fill={color} opacity="0.75"/>
        </g>
        {/* Legs */}
        <rect x="50" y="60" width="9" height="32" rx="4" fill={color} opacity="0.8"/>
        <rect x="61" y="60" width="9" height="32" rx="4" fill={color} opacity="0.8"/>
        {/* Feet */}
        <rect x="15" y="90" width="18" height="7" rx="3" fill={color} opacity="0.6"/>
        <rect x="87" y="90" width="18" height="7" rx="3" fill={color} opacity="0.6"/>
      </g>
      {/* Floor line */}
      <rect x="10" y="98" width="100" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

function PullFigure({ color }) {
  return (
    <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      {/* Bar */}
      <rect x="10" y="20" width="120" height="6" rx="3" fill={color} opacity="0.3"/>
      <circle cx="30" cy="23" r="5" fill={color} opacity="0.5"/>
      <circle cx="110" cy="23" r="5" fill={color} opacity="0.5"/>
      {/* Figure hanging and pulling */}
      <g style={{transformOrigin:"70px 30px", animation:"pull-torso 1.6s ease-in-out infinite"}}>
        {/* Arms up */}
        <rect x="55" y="26" width="8" height="22" rx="4" fill={color} opacity="0.75"/>
        <rect x="77" y="26" width="8" height="22" rx="4" fill={color} opacity="0.75"/>
        {/* Head */}
        <circle cx="70" cy="55" r="11" fill={color} opacity="0.9"/>
        {/* Torso */}
        <rect x="61" y="67" width="18" height="28" rx="6" fill={color} opacity="0.85"/>
        {/* Legs */}
        <rect x="61" y="93" width="8" height="28" rx="4" fill={color} opacity="0.75" style={{transformOrigin:"65px 93px",animation:"lunge-frontleg 1.6s ease-in-out infinite"}}/>
        <rect x="71" y="93" width="8" height="26" rx="4" fill={color} opacity="0.75"/>
      </g>
    </svg>
  );
}

function SquatFigure({ color }) {
  return (
    <svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <g style={{transformOrigin:"60px 70px", animation:"squat-body 1.5s ease-in-out infinite"}}>
        {/* Head */}
        <circle cx="60" cy="18" r="12" fill={color} opacity="0.9"/>
        {/* Torso */}
        <rect x="50" y="32" width="20" height="30" rx="6" fill={color} opacity="0.85"/>
        {/* Arms out for balance */}
        <rect x="18" y="44" width="30" height="7" rx="3.5" fill={color} opacity="0.7"/>
        <rect x="72" y="44" width="30" height="7" rx="3.5" fill={color} opacity="0.7"/>
        {/* Upper legs */}
        <g style={{transformOrigin:"55px 62px", animation:"squat-legs 1.5s ease-in-out infinite"}}>
          <rect x="48" y="62" width="9" height="28" rx="4" fill={color} opacity="0.8"/>
        </g>
        <g style={{transformOrigin:"65px 62px", animation:"squat-legs 1.5s ease-in-out infinite", transform:"scaleX(-1) translateX(-120px)"}}>
          <rect x="63" y="62" width="9" height="28" rx="4" fill={color} opacity="0.8"/>
        </g>
        {/* Lower legs */}
        <rect x="42" y="88" width="9" height="24" rx="4" fill={color} opacity="0.7"/>
        <rect x="69" y="88" width="9" height="24" rx="4" fill={color} opacity="0.7"/>
        {/* Feet */}
        <rect x="36" y="110" width="20" height="7" rx="3" fill={color} opacity="0.6"/>
        <rect x="64" y="110" width="20" height="7" rx="3" fill={color} opacity="0.6"/>
      </g>
      <rect x="10" y="118" width="100" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

function HingeFigure({ color }) {
  return (
    <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      {/* Legs stay mostly static */}
      <rect x="54" y="75" width="10" height="40" rx="5" fill={color} opacity="0.8"/>
      <rect x="68" y="75" width="10" height="40" rx="5" fill={color} opacity="0.8"/>
      <rect x="46" y="112" width="22" height="8" rx="4" fill={color} opacity="0.6"/>
      <rect x="64" y="112" width="22" height="8" rx="4" fill={color} opacity="0.6"/>
      {/* Torso hinges forward */}
      <g style={{transformOrigin:"66px 75px", animation:"hinge-torso 1.6s ease-in-out infinite"}}>
        <rect x="56" y="40" width="20" height="36" rx="6" fill={color} opacity="0.85"/>
        {/* Head */}
        <circle cx="66" cy="28" r="11" fill={color} opacity="0.9"/>
        {/* Arms hang down */}
        <rect x="36" y="52" width="20" height="8" rx="4" fill={color} opacity="0.7"/>
        <rect x="76" y="52" width="20" height="8" rx="4" fill={color} opacity="0.7"/>
      </g>
      <rect x="10" y="121" width="120" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

function CoreFigure({ color }) {
  return (
    <svg viewBox="0 0 140 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      {/* Lower body on floor */}
      <rect x="50" y="85" width="10" height="30" rx="5" fill={color} opacity="0.75" style={{transformOrigin:"55px 85px",animation:"core-lower 1.4s ease-in-out infinite"}}/>
      <rect x="64" y="85" width="10" height="30" rx="5" fill={color} opacity="0.75" style={{transformOrigin:"69px 85px",animation:"core-lower 1.4s ease-in-out infinite",animationDelay:"0.1s"}}/>
      {/* Hips */}
      <ellipse cx="67" cy="84" rx="18" ry="8" fill={color} opacity="0.7"/>
      {/* Upper body crunches up */}
      <g style={{transformOrigin:"67px 80px", animation:"core-upper 1.4s ease-in-out infinite"}}>
        <rect x="57" y="50" width="20" height="32" rx="6" fill={color} opacity="0.85"/>
        {/* Head */}
        <circle cx="67" cy="38" r="11" fill={color} opacity="0.9"/>
        {/* Arms behind head */}
        <rect x="34" y="42" width="22" height="7" rx="3.5" fill={color} opacity="0.65"/>
        <rect x="78" y="42" width="22" height="7" rx="3.5" fill={color} opacity="0.65"/>
      </g>
      {/* Floor */}
      <rect x="10" y="116" width="120" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

function LungeFigure({ color }) {
  return (
    <svg viewBox="0 0 160 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <g style={{transformOrigin:"75px 60px", animation:"lunge-body 1.5s ease-in-out infinite"}}>
        {/* Head */}
        <circle cx="75" cy="22" r="11" fill={color} opacity="0.9"/>
        {/* Torso */}
        <rect x="65" y="35" width="20" height="30" rx="6" fill={color} opacity="0.85"/>
        {/* Arms */}
        <rect x="38" y="48" width="26" height="7" rx="3.5" fill={color} opacity="0.7"/>
        <rect x="86" y="48" width="26" height="7" rx="3.5" fill={color} opacity="0.7"/>
        {/* Front leg */}
        <g style={{transformOrigin:"70px 65px", animation:"lunge-frontleg 1.5s ease-in-out infinite"}}>
          <rect x="65" y="65" width="10" height="35" rx="5" fill={color} opacity="0.8"/>
          <rect x="60" y="98" width="10" height="28" rx="5" fill={color} opacity="0.75"/>
        </g>
        {/* Back leg */}
        <g style={{transformOrigin:"80px 65px", animation:"lunge-backleg 1.5s ease-in-out infinite"}}>
          <rect x="75" y="65" width="10" height="32" rx="5" fill={color} opacity="0.8"/>
          <rect x="78" y="95" width="10" height="28" rx="5" fill={color} opacity="0.75"/>
        </g>
      </g>
      <rect x="10" y="126" width="140" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

function MetconFigure({ color }) {
  return (
    <svg viewBox="0 0 140 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <g style={{transformOrigin:"70px 70px", animation:"metcon-body 0.9s ease-in-out infinite"}}>
        {/* Head */}
        <circle cx="70" cy="20" r="12" fill={color} opacity="0.9"/>
        {/* Torso */}
        <rect x="60" y="34" width="20" height="28" rx="6" fill={color} opacity="0.85"/>
        {/* Left arm */}
        <g style={{transformOrigin:"60px 42px", animation:"metcon-arms 0.9s ease-in-out infinite"}}>
          <rect x="28" y="38" width="32" height="8" rx="4" fill={color} opacity="0.75"/>
        </g>
        {/* Right arm */}
        <g style={{transformOrigin:"80px 42px", animation:"metcon-arms 0.9s ease-in-out infinite", animationDelay:"0s", transform:"scaleX(-1) translateX(-140px)"}}>
          <rect x="80" y="38" width="32" height="8" rx="4" fill={color} opacity="0.75"/>
        </g>
        {/* Left leg */}
        <g style={{transformOrigin:"65px 62px", animation:"metcon-legs 0.9s ease-in-out infinite"}}>
          <rect x="58" y="62" width="10" height="38" rx="5" fill={color} opacity="0.8"/>
        </g>
        {/* Right leg */}
        <g style={{transformOrigin:"75px 62px", animation:"metcon-legs 0.9s ease-in-out infinite", animationDelay:"0.45s"}}>
          <rect x="72" y="62" width="10" height="38" rx="5" fill={color} opacity="0.8"/>
        </g>
        {/* Feet */}
        <rect x="44" y="98" width="18" height="7" rx="3" fill={color} opacity="0.65" style={{animation:"metcon-legs 0.9s ease-in-out infinite"}}/>
        <rect x="78" y="98" width="18" height="7" rx="3" fill={color} opacity="0.65" style={{animation:"metcon-legs 0.9s ease-in-out infinite",animationDelay:"0.45s"}}/>
      </g>
      <rect x="10" y="108" width="120" height="2" rx="1" fill={color} opacity="0.2"/>
    </svg>
  );
}

const FIGURES = { PUSH:PushFigure, PULL:PullFigure, SQUAT:SquatFigure, HINGE:HingeFigure, CORE:CoreFigure, LUNGE:LungeFigure, METCON:MetconFigure };

function ExerciseFigure({ slotType, color }) {
  const Figure = FIGURES[slotType] || SquatFigure;
  return <Figure color={color}/>;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ExercisePreview({ slots = [], track, onStart, onSkip }) {
  const [cardIdx,   setCardIdx]   = useState(0);
  const [autoTimer, setAutoTimer] = useState(10);
  const [paused,    setPaused]    = useState(false);
  const timerRef = useRef(null);

  const C       = track?.color || "#F0C060";
  const cur     = slots[cardIdx];
  const isLast  = cardIdx >= slots.length - 1;
  const slotColor = SLOT_COLORS[cur?.slotType] || C;

  // Auto-advance countdown
  useEffect(() => {
    if (paused) return;
    setAutoTimer(10);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setAutoTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (isLast) onStart(); else setCardIdx(i => i + 1);
          return 10;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cardIdx, paused, isLast]);

  const goNext = () => {
    clearInterval(timerRef.current);
    if (cardIdx >= slots.length - 1) onStart();
    else { setCardIdx(i => Math.min(i + 1, slots.length - 1)); setAutoTimer(10); }
  };
  const goPrev = () => {
    if (cardIdx > 0) { clearInterval(timerRef.current); setCardIdx(i => i - 1); setAutoTimer(10); }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#06080C",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"'Barlow Condensed',sans-serif"}}>
      <style>{ANIM_CSS}</style>

      {/* Top bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 8px",flexShrink:0}}>
        <div>
          <div style={{fontSize:10,color:"rgba(238,242,248,0.3)",fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase"}}>Exercise Preview</div>
          <div style={{fontSize:16,fontWeight:800,color:"rgba(238,242,248,0.65)",letterSpacing:"0.05em",textTransform:"uppercase"}}>{track?.name} Protocol</div>
        </div>
        <button onClick={onSkip} style={{padding:"8px 18px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(238,242,248,0.4)",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:"0.1em"}}>SKIP →</button>
      </div>

      {/* Progress dots */}
      <div style={{display:"flex",gap:5,padding:"0 20px 12px",flexShrink:0}}>
        {slots.map((_,i) => (
          <div key={i} onClick={()=>{clearInterval(timerRef.current);setCardIdx(i);setAutoTimer(10);}} style={{flex:1,height:3,borderRadius:2,cursor:"pointer",background:i<=cardIdx?slotColor:"rgba(255,255,255,0.08)",opacity:i===cardIdx?1:i<cardIdx?0.45:0.2,transition:"all 0.4s"}}/>
        ))}
      </div>

      {/* Slot badge */}
      <div style={{textAlign:"center",paddingBottom:10,flexShrink:0}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:10,padding:"5px 16px",borderRadius:20,background:`${slotColor}12`,border:`1px solid ${slotColor}30`}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:slotColor,animation:"pulse 1.5s ease-in-out infinite"}}/>
          <span style={{fontSize:10,fontWeight:800,color:slotColor,letterSpacing:"0.12em"}}>{cur?.slotType}</span>
          <span style={{fontSize:10,color:"rgba(238,242,248,0.2)"}}>·</span>
          <span style={{fontSize:10,color:"rgba(238,242,248,0.4)",fontWeight:600,letterSpacing:"0.05em"}}>{cardIdx+1} OF {slots.length}</span>
        </div>
      </div>

      {/* Animation stage */}
      <div key={cardIdx} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 40px",minHeight:0,animation:"fadeIn 0.35s ease"}}>
        <div style={{
          width:"100%",maxWidth:300,aspectRatio:"1/1",
          position:"relative",
          display:"flex",alignItems:"center",justifyContent:"center"
        }}>
          {/* Glow behind figure */}
          <div style={{
            position:"absolute",inset:"15%",
            borderRadius:"50%",
            background:`radial-gradient(circle, ${slotColor}18 0%, transparent 70%)`,
            filter:"blur(20px)",
          }}/>
          {/* Subtle grid floor */}
          <div style={{
            position:"absolute",bottom:"8%",left:"5%",right:"5%",height:"30%",
            background:`repeating-linear-gradient(90deg,${slotColor}06 0px,${slotColor}06 1px,transparent 1px,transparent 28px)`,
            maskImage:"linear-gradient(to top, rgba(0,0,0,0.4), transparent)"
          }}/>
          {/* The figure */}
          <div style={{width:"75%",height:"75%",position:"relative",zIndex:2}}>
            <ExerciseFigure slotType={cur?.slotType} color={slotColor}/>
          </div>
        </div>
      </div>

      {/* Exercise info */}
      <div key={`info-${cardIdx}`} style={{padding:"8px 24px 4px",flexShrink:0,animation:"slideUp 0.35s ease"}}>
        {/* Exercise name */}
        <div style={{fontSize:34,fontWeight:900,color:"#EEF2F8",letterSpacing:"0.01em",lineHeight:1,marginBottom:4,textTransform:"uppercase"}}>
          {cur?.exerciseName||cur?.exercise}
        </div>
        {/* Sets × reps */}
        <div style={{fontSize:15,color:slotColor,fontWeight:800,letterSpacing:"0.08em",marginBottom:cur?.cue?10:0}}>
          {cur?.sets} × {cur?.reps}
        </div>
        {/* Cue */}
        {cur?.cue && (
          <div style={{
            padding:"10px 14px",borderRadius:12,
            background:"rgba(255,255,255,0.04)",
            border:`1px solid rgba(255,255,255,0.07)`,
            fontSize:13,color:"rgba(238,242,248,0.6)",
            lineHeight:1.55,fontFamily:"'DM Sans',sans-serif",fontWeight:500
          }}>
            💡 {cur.cue}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{padding:"12px 20px",paddingBottom:"max(16px,env(safe-area-inset-bottom))",flexShrink:0}}>
        {/* Countdown bar */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{flex:1,height:2,borderRadius:1,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${(autoTimer/10)*100}%`,background:slotColor,borderRadius:1,transition:"width 1s linear"}}/>
          </div>
          <button onClick={()=>setPaused(p=>!p)} style={{width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"none",color:"rgba(238,242,248,0.4)",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {paused?"▶":"⏸"}
          </button>
          <div style={{fontSize:11,color:"rgba(238,242,248,0.3)",fontWeight:700,width:14,textAlign:"right",flexShrink:0}}>{autoTimer}</div>
        </div>

        {/* Nav */}
        <div style={{display:"flex",gap:10}}>
          {cardIdx>0&&(
            <button onClick={goPrev} style={{padding:"14px 20px",borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(238,242,248,0.5)",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,flexShrink:0,letterSpacing:"0.05em"}}>← PREV</button>
          )}
          <button onClick={goNext} style={{
            flex:1,padding:"16px",borderRadius:14,border:"none",
            background: isLast ? `linear-gradient(135deg,${C},${C}CC)` : `${slotColor}`,
            color:"#06080C",
            fontFamily:"'Barlow Condensed',sans-serif",
            fontSize: isLast ? 20 : 16,
            fontWeight:900,letterSpacing:"0.08em",cursor:"pointer",
            boxShadow: isLast ? `0 8px 28px ${C}35` : `0 4px 16px ${slotColor}30`
          }}>
            {isLast ? "▶ START SESSION" : `NEXT: ${slots[cardIdx+1]?.exerciseName||slots[cardIdx+1]?.exercise||"→"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
