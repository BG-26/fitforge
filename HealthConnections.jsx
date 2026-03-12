import { useState, useEffect, useRef } from "react";

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

// ─── PLATFORM REGISTRY ────────────────────────────────────────────────────────
export const HEALTH_PLATFORMS = {
  GOOGLE_FIT: {
    id: "GOOGLE_FIT",
    name: "Google Fit",
    icon: "🟢",
    color: "#34D399",
    desc: "Heart rate, calories, weight, activity",
    available: true,
    capabilities: ["hr_live","calories","weight","steps","sleep"],
    authType: "oauth2",
    // Real impl: replace with your Google OAuth client ID
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.activity.read",
    apiBase: "https://www.googleapis.com/fitness/v1/users/me",
  },
  FITBIT: {
    id: "FITBIT",
    name: "Fitbit",
    icon: "🔵",
    color: "#60A5FA",
    desc: "Heart rate, sleep, HRV, calories, weight",
    available: true,
    capabilities: ["hr_live","hr_resting","hrv","calories","weight","sleep","steps"],
    authType: "oauth2",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    scope: "heartrate sleep weight activity",
    apiBase: "https://api.fitbit.com/1/user/-",
  },
  GARMIN: {
    id: "GARMIN",
    name: "Garmin Connect",
    icon: "⚫",
    color: "#A78BFA",
    desc: "Activity, heart rate, HRV, sleep, calories",
    available: true,
    capabilities: ["hr_live","hr_resting","hrv","calories","sleep","steps"],
    authType: "oauth1",
    authUrl: "https://connect.garmin.com/oauthConfirm",
    apiBase: "https://apis.garmin.com/wellness-api/rest",
  },
  APPLE_WATCH: {
    id: "APPLE_WATCH",
    name: "Apple Watch",
    icon: "⌚",
    color: "#E879F9",
    desc: "Heart rate, calories, workouts — requires iOS app",
    available: false, // web limitation
    capabilities: ["hr_live","hr_resting","hrv","calories","sleep","steps"],
    authType: "native",
    nativeNote: "Apple Watch HR integration requires the FitForge iOS app, coming soon.",
  },
  APPLE_HEALTH: {
    id: "APPLE_HEALTH",
    name: "Apple Health",
    icon: "🍎",
    color: "#F87171",
    desc: "Full health data — requires native iOS app",
    available: false,
    capabilities: ["hr_resting","hrv","calories","weight","sleep","steps"],
    authType: "native",
    nativeNote: "Apple Health requires the FitForge iOS app. Export your Health data as XML to import manually.",
  },
};

// Data type metadata
const DATA_TYPES = {
  hr_live:    { label:"Live Heart Rate",     icon:"❤️",  color:"#F87171", desc:"Real-time HR during sessions" },
  hr_resting: { label:"Resting HR",          icon:"💤",  color:"#60A5FA", desc:"Baseline HR — feeds FX Engine score" },
  hrv:        { label:"HRV",                 icon:"📈",  color:"#A78BFA", desc:"Heart rate variability — recovery indicator" },
  calories:   { label:"Calorie Burn",        icon:"🔥",  color:"#FB923C", desc:"Cross-reference vs MET estimate" },
  weight:     { label:"Body Weight",         icon:"⚖️",  color:"#34D399", desc:"Auto-sync to profile for calorie accuracy" },
  sleep:      { label:"Sleep",               icon:"🌙",  color:"#5EEAD4", desc:"Recovery context before sessions" },
  steps:      { label:"Steps / Activity",    icon:"👟",  color:"#F0C060", desc:"Weekly activity summary" },
};

// ─── MOCK OAUTH FLOW ──────────────────────────────────────────────────────────
// In production: replace with real OAuth redirect + token exchange.
// This simulates the connection flow with a popup and mock token.
function simulateOAuth(platform) {
  return new Promise((resolve) => {
    // In real implementation:
    // 1. Open popup to platform.authUrl with client_id, redirect_uri, scope
    // 2. Listen for postMessage callback with auth code
    // 3. Exchange code for access token via your backend
    // 4. Store token securely (httpOnly cookie or Supabase vault)
    // For now: simulate 1.5s auth delay
    setTimeout(() => {
      resolve({
        platformId: platform.id,
        accessToken: `mock_token_${platform.id}_${Date.now()}`,
        refreshToken: `mock_refresh_${Date.now()}`,
        expiresAt: Date.now() + 3600000,
        connectedAt: Date.now(),
        scope: platform.scope || "",
      });
    }, 1500);
  });
}

// ─── MOCK DATA FETCH ──────────────────────────────────────────────────────────
// In production: replace each fetch with real API calls using stored token.
export async function fetchPlatformData(platformId, dataTypes) {
  // Simulate API latency
  await new Promise(r => setTimeout(r, 600));

  // Mock data — replace with real API calls:
  // Google Fit: GET /fitness/v1/users/me/dataSources
  // Fitbit: GET /1/user/-/activities/heart/date/today/1d.json
  // Garmin: GET /wellness-api/rest/dailies?uploadStartTimeInSeconds=...
  // weight: pulled from platform if user has logged it
  // auto-sync: App.jsx watches this field and updates user.weightKg when non-null
  const platformHasWeight = platformId === "FITBIT" || platformId === "GOOGLE_FIT";
  const mockWeight = platformHasWeight ? parseFloat((68 + Math.random() * 30).toFixed(1)) : null;

  return {
    hr_live: null, // populated during session via useLiveHR polling
    hr_resting: Math.round(58 + Math.random() * 20), // bpm
    hrv: Math.round(35 + Math.random() * 40), // ms RMSSD
    calories: {
      active: Math.round(300 + Math.random() * 200),
      total: Math.round(1800 + Math.random() * 400),
    },
    weight: mockWeight, // kg — auto-synced to user.weightKg in App.jsx on fetch
    sleep: {
      durationHours: parseFloat((5.5 + Math.random() * 3).toFixed(1)),
      quality: ["Poor","Fair","Good","Excellent"][Math.floor(Math.random()*4)],
      deepPercent: Math.round(15 + Math.random() * 20),
    },
    steps: Math.round(4000 + Math.random() * 8000),
    fetchedAt: Date.now(),
    platformId,
  };
}

// Recovery context based on sleep + HRV
export function getRecoveryContext(healthData) {
  if (!healthData) return null;
  const { sleep, hrv, hr_resting } = healthData;
  let score = 100;
  let flags = [];

  if (sleep?.durationHours < 6) { score -= 30; flags.push({ text:`Only ${sleep.durationHours}h sleep — consider scaling today`, severity:"warn", icon:"🌙" }); }
  else if (sleep?.durationHours >= 8) { score += 5; flags.push({ text:`Well rested (${sleep.durationHours}h) — good session conditions`, severity:"good", icon:"✨" }); }

  if (hrv && hrv < 30) { score -= 20; flags.push({ text:`Low HRV (${hrv}ms) — nervous system under stress`, severity:"warn", icon:"📉" }); }
  else if (hrv && hrv > 60) { score += 10; flags.push({ text:`High HRV (${hrv}ms) — strong recovery`, severity:"good", icon:"📈" }); }

  if (hr_resting && hr_resting > 70) { score -= 10; flags.push({ text:`Elevated resting HR (${hr_resting}bpm) — possible fatigue`, severity:"caution", icon:"❤️" }); }

  return {
    score: Math.min(100, Math.max(0, score)),
    label: score >= 85 ? "Ready" : score >= 65 ? "Good" : score >= 45 ? "Moderate" : "Low",
    color: score >= 85 ? "#34D399" : score >= 65 ? "#F0C060" : score >= 45 ? "#FB923C" : "#F87171",
    flags,
  };
}

// ─── CONNECTION MANAGER (localStorage) ───────────────────────────────────────
export const ConnectionManager = {
  getConnections: () => {
    try { return JSON.parse(localStorage.getItem("ff_health_connections") || "{}"); } catch { return {}; }
  },
  setConnection: (platformId, data) => {
    try {
      const all = ConnectionManager.getConnections();
      all[platformId] = data;
      localStorage.setItem("ff_health_connections", JSON.stringify(all));
    } catch {}
  },
  removeConnection: (platformId) => {
    try {
      const all = ConnectionManager.getConnections();
      delete all[platformId];
      localStorage.setItem("ff_health_connections", JSON.stringify(all));
    } catch {}
  },
  isConnected: (platformId) => {
    const c = ConnectionManager.getConnections();
    return !!(c[platformId]?.accessToken);
  },
  getCachedData: (platformId) => {
    try { return JSON.parse(localStorage.getItem(`ff_health_data_${platformId}`) || "null"); } catch { return null; }
  },
  setCachedData: (platformId, data) => {
    try { localStorage.setItem(`ff_health_data_${platformId}`, JSON.stringify(data)); } catch {}
  },
};

// ─── LIVE HR POLLER ───────────────────────────────────────────────────────────
// Polls connected platform for HR every 5s during active sessions.
// In production: replace with real WebSocket or polling API call.
export function useLiveHR(platformId, active) {
  const [hr, setHR] = useState(null);
  const [zone, setZone] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active || !platformId || !ConnectionManager.isConnected(platformId)) return;

    const poll = async () => {
      // In production: fetch real-time HR from platform API
      // Fitbit: GET /1/user/-/activities/heart/date/today/1d/1min.json
      // Garmin: WebSocket or polling /wellness-api/rest/epochs/activities
      // Simulate realistic HR fluctuation during workout
      const base = 130 + Math.random() * 40;
      const mockHR = Math.round(base);
      const maxHR = 190; // would use user age
      const pct = mockHR / maxHR;
      const z = pct < 0.6 ? 1 : pct < 0.7 ? 2 : pct < 0.8 ? 3 : pct < 0.9 ? 4 : 5;
      setHR(mockHR);
      setZone(z);
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [active, platformId]);

  return { hr, zone };
}

// ─── SETTINGS: HEALTH CONNECTIONS PANEL ──────────────────────────────────────
export function HealthConnectionsPanel({ user, onDataUpdate }) {
  const [connections, setConnections] = useState(ConnectionManager.getConnections());
  const [connecting, setConnecting] = useState(null);
  const [healthData, setHealthData] = useState({});
  const [syncing, setSyncing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  // Load cached data on mount
  useEffect(() => {
    const data = {};
    Object.keys(connections).forEach(pid => {
      data[pid] = ConnectionManager.getCachedData(pid);
    });
    setHealthData(data);
  }, []);

  const connect = async (platform) => {
    if (!platform.available) return;
    setConnecting(platform.id);
    try {
      const token = await simulateOAuth(platform);
      ConnectionManager.setConnection(platform.id, token);
      setConnections(c => ({ ...c, [platform.id]: token }));
      // Immediately fetch data
      await syncData(platform.id);
    } catch (e) {
      console.error("Connection failed:", e);
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = (platformId) => {
    ConnectionManager.removeConnection(platformId);
    setConnections(c => { const n={...c}; delete n[platformId]; return n; });
    setHealthData(d => { const n={...d}; delete n[platformId]; return n; });
  };

  const syncData = async (platformId) => {
    setSyncing(platformId);
    try {
      const platform = HEALTH_PLATFORMS[platformId];
      const data = await fetchPlatformData(platformId, platform.capabilities);
      ConnectionManager.setCachedData(platformId, data);
      setHealthData(d => ({ ...d, [platformId]: data }));
      onDataUpdate?.(platformId, data);
    } finally {
      setSyncing(null);
    }
  };

  const connectedCount = Object.keys(connections).length;
  const allHealthData = Object.values(healthData).filter(Boolean);
  const latestHR = allHealthData.map(d=>d.hr_resting).filter(Boolean).sort((a,b)=>a-b)[0];
  const latestWeight = allHealthData.map(d=>d.weight).filter(Boolean)[0];
  const latestSleep = allHealthData.map(d=>d.sleep).filter(Boolean)[0];
  const latestHRV = allHealthData.map(d=>d.hrv).filter(Boolean)[0];
  const recovery = getRecoveryContext(allHealthData[0]);

  return (
    <div style={{fontFamily:FB,color:TEXT}}>

      {/* Summary row if connected */}
      {connectedCount > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
          {latestHR && (
            <div style={{padding:"14px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>❤️</div>
              <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:"#F87171"}}>{latestHR}</div>
              <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>Resting HR</div>
            </div>
          )}
          {latestHRV && (
            <div style={{padding:"14px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>📈</div>
              <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:"#A78BFA"}}>{latestHRV}<span style={{fontSize:14,fontWeight:400}}>ms</span></div>
              <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>HRV</div>
            </div>
          )}
          {latestSleep && (
            <div style={{padding:"14px",borderRadius:14,background:SURFACE,border:`1px solid ${BORDER2}`,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>🌙</div>
              <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:"#5EEAD4"}}>{latestSleep.durationHours}h</div>
              <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>Sleep</div>
            </div>
          )}
          {recovery && (
            <div style={{padding:"14px",borderRadius:14,background:`${recovery.color}0C`,border:`1px solid ${recovery.color}25`,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>⚡</div>
              <div style={{fontFamily:FD,fontSize:24,fontWeight:800,color:recovery.color}}>{recovery.label}</div>
              <div style={{fontSize:10,color:MUTED,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>Recovery</div>
            </div>
          )}
        </div>
      )}

      {/* Platform list */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {Object.values(HEALTH_PLATFORMS).map(platform => {
          const isConnected = !!connections[platform.id];
          const isConnecting = connecting === platform.id;
          const isSyncing = syncing === platform.id;
          const data = healthData[platform.id];
          const isExpanded = expanded === platform.id;

          return (
            <div key={platform.id} style={{
              borderRadius:16,
              border:`1.5px solid ${isConnected?platform.color+"40":BORDER2}`,
              background:isConnected?`${platform.color}08`:SURFACE,
              overflow:"hidden",transition:"all 0.2s"
            }}>
              {/* Platform header */}
              <div style={{padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{
                    width:44,height:44,borderRadius:12,
                    background:isConnected?`${platform.color}15`:FAINT,
                    border:`1px solid ${isConnected?platform.color+"30":BORDER}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:22,flexShrink:0
                  }}>{platform.icon}</div>
                  <div>
                    <div style={{fontFamily:FD,fontSize:18,fontWeight:800,letterSpacing:"0.04em",color:isConnected?platform.color:TEXT}}>
                      {platform.name}
                      {isConnected && <span style={{fontSize:11,fontFamily:FB,fontWeight:600,color:"#34D399",marginLeft:8}}>● Connected</span>}
                    </div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2}}>{platform.desc}</div>
                  </div>
                </div>

                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:10}}>
                  {isConnected && (
                    <button onClick={()=>setExpanded(isExpanded?null:platform.id)} style={{
                      padding:"7px 11px",borderRadius:9,background:FAINT,border:`1px solid ${BORDER2}`,
                      color:MUTED,cursor:"pointer",fontFamily:FB,fontSize:12
                    }}>{isExpanded?"▲":"▼"}</button>
                  )}
                  {!platform.available ? (
                    <div style={{padding:"7px 12px",borderRadius:9,background:FAINT,border:`1px solid ${BORDER}`,color:MUTED,fontSize:11,fontWeight:600}}>
                      iOS App
                    </div>
                  ) : isConnected ? (
                    <button onClick={()=>syncData(platform.id)} disabled={isSyncing} style={{
                      padding:"7px 12px",borderRadius:9,
                      background:isSyncing?FAINT:`${platform.color}12`,
                      border:`1px solid ${isSyncing?BORDER2:platform.color+"30"}`,
                      color:isSyncing?MUTED:platform.color,
                      cursor:isSyncing?"not-allowed":"pointer",fontFamily:FB,fontSize:12,fontWeight:600
                    }}>{isSyncing?"Syncing…":"↻ Sync"}</button>
                  ) : (
                    <button onClick={()=>connect(platform)} disabled={isConnecting} style={{
                      padding:"9px 16px",borderRadius:10,border:"none",
                      background:isConnecting?FAINT:platform.color,
                      color:isConnecting?MUTED:BG,
                      cursor:isConnecting?"not-allowed":"pointer",
                      fontFamily:FD,fontSize:16,fontWeight:800,letterSpacing:"0.06em",
                      transition:"all 0.2s",
                      boxShadow:isConnecting?"none":`0 4px 16px ${platform.color}30`
                    }}>{isConnecting?"Connecting…":"CONNECT"}</button>
                  )}
                </div>
              </div>

              {/* Native app note */}
              {!platform.available && (
                <div style={{padding:"0 18px 14px",fontSize:12,color:MUTED,lineHeight:1.5}}>
                  {platform.nativeNote}
                  {platform.id==="APPLE_HEALTH" && (
                    <span style={{color:platform.color,fontWeight:600,marginLeft:4,cursor:"pointer"}}> Import XML →</span>
                  )}
                </div>
              )}

              {/* Expanded data view */}
              {isExpanded && isConnected && (
                <div style={{padding:"0 18px 16px",borderTop:`1px solid ${BORDER}`,paddingTop:14}}>
                  {data ? (
                    <div>
                      <div style={{fontSize:10,color:MUTED,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
                        SYNCED DATA · {new Date(data.fetchedAt).toLocaleTimeString()}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                        {data.hr_resting && (
                          <div style={{padding:"10px 8px",borderRadius:10,background:FAINT,textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:"#F87171"}}>{data.hr_resting}</div>
                            <div style={{fontSize:9,color:MUTED,marginTop:2}}>Resting HR</div>
                          </div>
                        )}
                        {data.hrv && (
                          <div style={{padding:"10px 8px",borderRadius:10,background:FAINT,textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:"#A78BFA"}}>{data.hrv}<span style={{fontSize:11}}>ms</span></div>
                            <div style={{fontSize:9,color:MUTED,marginTop:2}}>HRV</div>
                          </div>
                        )}
                        {data.sleep && (
                          <div style={{padding:"10px 8px",borderRadius:10,background:FAINT,textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:"#5EEAD4"}}>{data.sleep.durationHours}h</div>
                            <div style={{fontSize:9,color:MUTED,marginTop:2}}>Sleep</div>
                          </div>
                        )}
                        {data.steps && (
                          <div style={{padding:"10px 8px",borderRadius:10,background:FAINT,textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:GOLD}}>{(data.steps/1000).toFixed(1)}k</div>
                            <div style={{fontSize:9,color:MUTED,marginTop:2}}>Steps</div>
                          </div>
                        )}
                        {data.calories && (
                          <div style={{padding:"10px 8px",borderRadius:10,background:FAINT,textAlign:"center"}}>
                            <div style={{fontFamily:FD,fontSize:20,fontWeight:800,color:"#FB923C"}}>{data.calories.active}</div>
                            <div style={{fontSize:9,color:MUTED,marginTop:2}}>Active kcal</div>
                          </div>
                        )}
                      </div>

                      {/* Capabilities list */}
                      <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:5}}>
                        {platform.capabilities.map(cap=>(
                          <span key={cap} style={{
                            fontSize:10,padding:"3px 8px",borderRadius:6,
                            background:`${platform.color}12`,
                            color:platform.color,fontWeight:600
                          }}>{DATA_TYPES[cap]?.icon} {DATA_TYPES[cap]?.label}</span>
                        ))}
                      </div>

                      <button onClick={()=>disconnect(platform.id)} style={{
                        marginTop:14,width:"100%",padding:"10px",borderRadius:10,
                        background:"transparent",border:"1px solid rgba(248,113,113,0.3)",
                        color:"#F87171",cursor:"pointer",fontFamily:FB,fontSize:12,fontWeight:600
                      }}>Disconnect {platform.name}</button>
                    </div>
                  ) : (
                    <div style={{fontSize:12,color:MUTED,padding:"8px 0"}}>
                      Tap Sync to load your data.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data usage note */}
      <div style={{marginTop:20,padding:"13px 16px",borderRadius:12,background:FAINT,border:`1px solid ${BORDER}`}}>
        <div style={{fontSize:11,color:MUTED,lineHeight:1.6}}>
          <span style={{color:TEXT,fontWeight:600}}>Your data stays on device.</span> FitForge reads health data locally to personalise sessions. It is never uploaded to external servers.
        </div>
      </div>
    </div>
  );
}

// ─── RECOVERY BANNER ──────────────────────────────────────────────────────────
// Shown at top of Train tab when health data is available
export function RecoveryBanner({ healthData, trackColor }) {
  const COLOR = trackColor || GOLD;
  if (!healthData) return null;
  const recovery = getRecoveryContext(healthData);
  if (!recovery || recovery.flags.length === 0) return null;

  return (
    <div style={{
      padding:"13px 16px",borderRadius:14,marginBottom:16,
      background:`${recovery.color}0C`,
      border:`1px solid ${recovery.color}25`,
      fontFamily:FB
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:recovery.flags.length>0?8:0}}>
        <div style={{fontSize:11,color:recovery.color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
          RECOVERY STATUS
        </div>
        <div style={{
          padding:"3px 10px",borderRadius:8,
          background:`${recovery.color}15`,
          fontFamily:FD,fontSize:14,fontWeight:800,color:recovery.color,
          letterSpacing:"0.04em"
        }}>{recovery.label}</div>
      </div>
      {recovery.flags.map((f,i)=>(
        <div key={i} style={{
          fontSize:12,color:f.severity==="good"?"#34D399":f.severity==="warn"?"#FB923C":MUTED,
          lineHeight:1.5,marginBottom:i<recovery.flags.length-1?4:0
        }}>{f.icon} {f.text}</div>
      ))}
    </div>
  );
}

// ─── LIVE HR WIDGET ───────────────────────────────────────────────────────────
// Small always-visible HR display during active session
export function LiveHRWidget({ hr, zone, platformId }) {
  const HR_ZONE_COLORS = ["","#60A5FA","#34D399","#F0C060","#FB923C","#F87171"];
  if (!hr || !platformId) return null;
  const color = HR_ZONE_COLORS[zone] || GOLD;

  return (
    <div style={{
      display:"inline-flex",alignItems:"center",gap:6,
      padding:"6px 12px",borderRadius:20,
      background:`${color}15`,border:`1px solid ${color}30`,
      fontFamily:FD,fontSize:16,fontWeight:800,color,
      animation:"pulse 1.5s ease infinite"
    }}>
      <span style={{fontSize:14,animation:"pulse 1s ease infinite"}}>❤️</span>
      {hr} <span style={{fontSize:11,fontWeight:600,opacity:0.7}}>Z{zone}</span>
    </div>
  );
}

// ─── RECAP HEALTH PANEL ───────────────────────────────────────────────────────
// Shown on SessionRecap when a platform is connected
export function RecapHealthPanel({ sessionData, platformData, peakHRDevice }) {
  if (!platformData && !peakHRDevice) return null;

  const GOLD2 = "#F0C060";
  const metCalories = sessionData?.calories;
  const deviceCalories = platformData?.calories?.active;
  const calDelta = metCalories && deviceCalories
    ? Math.round(((deviceCalories - metCalories.mid) / metCalories.mid) * 100)
    : null;

  return (
    <div style={{
      padding:"16px 18px",borderRadius:16,
      background:SURFACE,border:`1px solid ${BORDER2}`,
      marginBottom:16,fontFamily:FB
    }}>
      <div style={{fontSize:10,color:GOLD2,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12}}>
        ⌚ DEVICE DATA
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {peakHRDevice && (
          <div style={{padding:"12px 10px",borderRadius:12,background:FAINT,textAlign:"center"}}>
            <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:"#F87171"}}>{peakHRDevice}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:3}}>Peak HR (device)</div>
          </div>
        )}
        {deviceCalories && (
          <div style={{padding:"12px 10px",borderRadius:12,background:FAINT,textAlign:"center"}}>
            <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:"#FB923C"}}>{deviceCalories}</div>
            <div style={{fontSize:10,color:MUTED,marginTop:3}}>Calories (device)</div>
          </div>
        )}
        {platformData?.hrv && (
          <div style={{padding:"12px 10px",borderRadius:12,background:FAINT,textAlign:"center"}}>
            <div style={{fontFamily:FD,fontSize:28,fontWeight:800,color:"#A78BFA"}}>{platformData.hrv}<span style={{fontSize:13}}>ms</span></div>
            <div style={{fontSize:10,color:MUTED,marginTop:3}}>Post-session HRV</div>
          </div>
        )}
      </div>

      {calDelta !== null && (
        <div style={{
          marginTop:10,padding:"9px 12px",borderRadius:10,
          background:Math.abs(calDelta)>20?"rgba(251,146,60,0.08)":FAINT,
          fontSize:12,color:MUTED,lineHeight:1.5
        }}>
          {calDelta > 0
            ? `📊 Device shows ${calDelta}% more calories than estimated — you pushed hard.`
            : calDelta < -10
            ? `📊 Device shows ${Math.abs(calDelta)}% fewer calories than estimated — session was lighter.`
            : `📊 Device calories closely match FitForge estimate (±${Math.abs(calDelta)}%).`}
        </div>
      )}
    </div>
  );
}
