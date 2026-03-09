import { useState, useEffect, useCallback } from "react";

// 🔑 CHANGE THIS
const APP_PASSWORD = "unibo2025";

// 🗄️ PASTE YOUR SUPABASE DETAILS HERE
const SUPABASE_URL = "https://kegaybjxbcvxtkflmdxe.supabase.co";
const SUPABASE_KEY = "sb_publishable_QpN9v-S3sO-qQB616TtKNg_TohRlPGl";

async function sbGet(table, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const data = await r.json();
  return data[0] || null;
}

async function sbUpsert(table, id, payload) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id, ...payload }),
  });
}

async function sbGetAll(table) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return await r.json();
}

const WEEKDAY_TO_VILLA = [
  { time: "07:15", double: false }, { time: "08:10", double: false },
  { time: "08:40", double: false }, { time: "09:10", double: true },
  { time: "09:40", double: false }, { time: "12:45", double: false },
  { time: "13:45", double: false }, { time: "14:15", double: false },
  { time: "14:45", double: false }, { time: "16:45", double: false },
  { time: "17:20", double: true },  { time: "17:45", double: false },
  { time: "18:10", double: true },  { time: "18:45", double: false },
  { time: "20:00", double: false },
];
const WEEKDAY_FROM_VILLA = [
  { time: "07:25", double: false }, { time: "08:20", double: false },
  { time: "08:50", double: false }, { time: "09:20", double: true },
  { time: "09:50", double: false }, { time: "13:10", double: false },
  { time: "13:55", double: false }, { time: "14:25", double: false },
  { time: "14:55", double: false }, { time: "17:10", double: false },
  { time: "17:30", double: true },  { time: "17:40", double: false },
  { time: "18:10", double: false }, { time: "18:20", double: true },
  { time: "18:30", double: false }, { time: "19:10", double: false },
  { time: "20:10", double: false },
];
const SAT_TO_VILLA = [
  { time: "07:15", double: false }, { time: "07:45", double: false },
  { time: "08:45", double: false }, { time: "09:45", double: false },
  { time: "12:45", double: false }, { time: "13:45", double: false },
  { time: "14:15", double: false }, { time: "14:45", double: false },
  { time: "17:00", double: false }, { time: "18:00", double: false },
  { time: "19:00", double: false }, { time: "20:00", double: false },
];
const SAT_FROM_VILLA = [
  { time: "07:25", double: false }, { time: "07:55", double: false },
  { time: "08:55", double: false }, { time: "09:55", double: false },
  { time: "12:55", double: false }, { time: "13:55", double: false },
  { time: "14:25", double: false }, { time: "14:55", double: false },
  { time: "17:10", double: false }, { time: "18:10", double: false },
  { time: "19:10", double: false }, { time: "20:10", double: false },
];

function getNow() { const n = new Date(); return { h: n.getHours(), m: n.getMinutes(), day: n.getDay() }; }
function timeToMins(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minsNow() { const { h, m } = getNow(); return h * 60 + m; }
function isWeekday() { const d = getNow().day; return d >= 1 && d <= 5; }
function isSaturday() { return getNow().day === 6; }
function dayPrefix() { const d = getNow().day; return d === 6 ? "sat" : "wd"; }

const CAPACITY = 40;

function occupancyInfo(count, double) {
  const cap = double ? CAPACITY * 2 : CAPACITY;
  const pct = count / cap;
  if (pct < 0.4) return { label: "Comfortable", color: "#f97316", dot: "🟢" };
  if (pct < 0.75) return { label: "Busy", color: "#fb923c", dot: "🟡" };
  return { label: "Full", color: "#fff", dot: "🔴" };
}

// Prediction: uses feedback history to estimate occupancy
// Returns null if not enough data (<3 reports)
function getPrediction(history, double) {
  if (!history || history.total_reports < 3) return null;
  const cap = double ? CAPACITY * 2 : CAPACITY;
  const { more_crowded, less_crowded, total_reports } = history;
  // Score from -1 (always empty) to +1 (always full)
  const score = (more_crowded - less_crowded) / total_reports;
  // Map score to predicted occupancy %
  const basePct = 0.35; // assume moderate baseline
  const predictedPct = Math.max(0.05, Math.min(0.98, basePct + score * 0.55));
  const predictedCount = Math.round(predictedPct * cap);
  if (predictedPct < 0.4) return { label: "Likely comfortable", dot: "🟢", color: "#4ade80", pct: predictedPct };
  if (predictedPct < 0.75) return { label: "Likely busy", dot: "🟡", color: "#facc15", pct: predictedPct };
  return { label: "Likely full", dot: "🔴", color: "#f87171", pct: predictedPct };
}

// Reliability: based on no_show and two_buses reports
function getReliability(history) {
  if (!history || history.total_reports < 3) return null;
  const { no_show, two_buses, total_reports } = history;
  const badEvents = no_show + two_buses;
  const score = Math.round(((total_reports - badEvents) / total_reports) * 10);
  if (score >= 8) return { score, label: `${score}/10 reliable`, color: "#4ade80", icon: "✓" };
  if (score >= 5) return { score, label: `${score}/10 reliable`, color: "#facc15", icon: "⚠" };
  return { score, label: `${score}/10 reliable`, color: "#f87171", icon: "✗" };
}

const FEEDBACK_OPTIONS = [
  { id: "more_crowded", label: "More crowded than shown 😬", icon: "📈" },
  { id: "less_crowded", label: "Emptier than shown 😌", icon: "📉" },
  { id: "two_buses", label: "Two buses came 🚌🚌", icon: "🚌" },
  { id: "no_show", label: "Bus didn't show up 👻", icon: "👻" },
];

function LockScreen({ onUnlock }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const attempt = () => {
    if (input === APP_PASSWORD) { onUnlock(); }
    else {
      setShake(true); setError(true); setInput("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono','Courier New',monospace", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;min-height:100vh;margin:0;padding:0;background:#0a0a0a}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .shake{animation:shake .4s ease}
        @keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .lock-box{animation:fadein .5s ease}
      `}</style>
      <div className="lock-box" style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 72, color: "#f97316", letterSpacing: "-0.03em", marginBottom: 4 }}>59</div>
        <div style={{ fontSize: 11, color: "#444", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 48 }}>TPER Bologna · Restricted Access</div>
        <div style={{ fontSize: 32, marginBottom: 24 }}>🔑</div>
        <div className={shake ? "shake" : ""}>
          <input type="password" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && attempt()} placeholder="password" autoFocus
            style={{ width: "100%", background: "#111", border: `1.5px solid ${error ? "#ef4444" : "#333"}`, borderRadius: 10, padding: "14px 18px", color: "#fff", fontSize: 16, fontFamily: "'DM Mono',monospace", letterSpacing: ".15em", outline: "none", textAlign: "center", transition: "border-color .2s", marginBottom: 12 }} />
          {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>Wrong password. Try again.</div>}
          <button onClick={attempt} style={{ width: "100%", background: "#f97316", border: "none", borderRadius: 10, padding: "14px", color: "#000", fontSize: 13, fontFamily: "'DM Mono',monospace", letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", fontWeight: "bold" }}>
            Enter →
          </button>
        </div>
        <div style={{ marginTop: 40, fontSize: 10, color: "#333", letterSpacing: ".08em", textTransform: "uppercase" }}>Ask your group for the password</div>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [direction, setDirection] = useState("to");
  const [counts, setCounts] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [history, setHistory] = useState({});
  const [myBus, setMyBus] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(null);
  const [myFeedbacks, setMyFeedbacks] = useState({});
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try { if (sessionStorage.getItem("bus59_auth") === APP_PASSWORD) setUnlocked(true); } catch {}
  }, []);

  const handleUnlock = () => {
    try { sessionStorage.setItem("bus59_auth", APP_PASSWORD); } catch {}
    setUnlocked(true);
  };

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      const [countRows, fbRows, histRows] = await Promise.all([
        sbGetAll("bus_counts"),
        sbGetAll("bus_feedbacks"),
        sbGetAll("bus_history"),
      ]);
      const c = {}, f = {}, h = {};
      countRows.forEach(r => c[r.id] = { count: r.count });
      fbRows.forEach(r => f[r.id] = r.data);
      histRows.forEach(r => h[r.id] = r);
      setCounts(c); setFeedbacks(f); setHistory(h);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    loadAll();
    const id = setInterval(loadAll, 10000);
    return () => clearInterval(id);
  }, [loadAll, unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    try {
      const b = sessionStorage.getItem("mybus59"); if (b) setMyBus(b);
      const f = sessionStorage.getItem("myfeedbacks59"); if (f) setMyFeedbacks(JSON.parse(f));
    } catch {}
  }, [unlocked]);

  const getSchedule = () => {
    const wd = isWeekday(), sat = isSaturday();
    if (!wd && !sat) return [];
    if (direction === "to") return wd ? WEEKDAY_TO_VILLA : SAT_TO_VILLA;
    return wd ? WEEKDAY_FROM_VILLA : SAT_FROM_VILLA;
  };

  const cKey = (time) => `${direction}:${time}`;
  const fKey = (time) => `fb:${direction}:${time}`;
  // History key includes day-of-week so predictions are per weekday slot
  const hKey = (time) => `${dayPrefix()}:${direction}:${time}`;

  const toggleBus = async (time) => {
    const key = cKey(time);
    const isMe = myBus === key;
    const existing = counts[key]?.count || 0;
    if (isMe) {
      const newCount = Math.max(0, existing - 1);
      setCounts(prev => ({ ...prev, [key]: { count: newCount } }));
      setMyBus(null);
      try { sessionStorage.setItem("mybus59", ""); } catch {}
      await sbUpsert("bus_counts", key, { count: newCount });
    } else {
      if (myBus && myBus !== key) {
        const oldCount = Math.max(0, (counts[myBus]?.count || 1) - 1);
        setCounts(prev => ({ ...prev, [myBus]: { count: oldCount } }));
        await sbUpsert("bus_counts", myBus, { count: oldCount });
      }
      const newCount = existing + 1;
      setCounts(prev => ({ ...prev, [key]: { count: newCount } }));
      setMyBus(key);
      try { sessionStorage.setItem("mybus59", key); } catch {}
      await sbUpsert("bus_counts", key, { count: newCount });
      showToast("✓ Added to this bus");
    }
  };

  const submitFeedback = async (time, fbId) => {
    const key = fKey(time);
    const hkey = hKey(time);
    const myFbKey = `${direction}:${time}`;
    const alreadyMine = myFeedbacks[myFbKey] === fbId;
    const existing = feedbacks[key] || {};
    const updated = { ...existing };
    const currentHistory = history[hkey] || { more_crowded: 0, less_crowded: 0, no_show: 0, two_buses: 0, total_reports: 0 };
    const updatedHistory = { ...currentHistory };

    if (alreadyMine) {
      // Undo feedback
      updated[fbId] = Math.max(0, (updated[fbId] || 1) - 1);
      updatedHistory[fbId] = Math.max(0, (updatedHistory[fbId] || 1) - 1);
      updatedHistory.total_reports = Math.max(0, updatedHistory.total_reports - 1);
      const newMy = { ...myFeedbacks }; delete newMy[myFbKey];
      setMyFeedbacks(newMy);
      try { sessionStorage.setItem("myfeedbacks59", JSON.stringify(newMy)); } catch {}
    } else {
      // Remove old feedback from history if switching
      const oldFb = myFeedbacks[myFbKey];
      if (oldFb) {
        updated[oldFb] = Math.max(0, (updated[oldFb] || 1) - 1);
        updatedHistory[oldFb] = Math.max(0, (updatedHistory[oldFb] || 1) - 1);
        updatedHistory.total_reports = Math.max(0, updatedHistory.total_reports - 1);
      }
      updated[fbId] = (updated[fbId] || 0) + 1;
      updatedHistory[fbId] = (updatedHistory[fbId] || 0) + 1;
      updatedHistory.total_reports = updatedHistory.total_reports + 1;
      const newMy = { ...myFeedbacks, [myFbKey]: fbId };
      setMyFeedbacks(newMy);
      try { sessionStorage.setItem("myfeedbacks59", JSON.stringify(newMy)); } catch {}
      showToast("Feedback saved — helps future predictions 📊");
    }

    setFeedbacks(prev => ({ ...prev, [key]: updated }));
    setHistory(prev => ({ ...prev, [hkey]: updatedHistory }));
    setFeedbackOpen(null);

    await Promise.all([
      sbUpsert("bus_feedbacks", key, { data: updated }),
      sbUpsert("bus_history", hkey, {
        more_crowded: updatedHistory.more_crowded,
        less_crowded: updatedHistory.less_crowded,
        no_show: updatedHistory.no_show,
        two_buses: updatedHistory.two_buses,
        total_reports: updatedHistory.total_reports,
      }),
    ]);
  };

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  const schedule = getSchedule().sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
  const now = minsNow() + tick * 0;
  const upcoming = schedule.filter(b => timeToMins(b.time) >= now - 5);
  const past = schedule.filter(b => timeToMins(b.time) < now - 5);
  const dayLabel = isWeekday() ? "Mon–Fri" : isSaturday() ? "Saturday" : "Sunday";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a0a0a", fontFamily: "'DM Mono','Courier New',monospace", color: "#e8e8e8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;min-height:100vh;margin:0;padding:0;background:#0a0a0a}
        .card{background:#111;border:1px solid #222;border-radius:14px;padding:16px 18px;transition:all .18s ease;position:relative}
        .card.mine{border-color:#f97316;background:#1a0f00}
        .card.past{opacity:.35}
        .card.upcoming{cursor:pointer}
        .card.upcoming:hover{border-color:#444;transform:translateY(-1px)}
        .dir-btn{padding:9px 18px;border-radius:50px;border:1.5px solid #333;background:transparent;color:#888;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s;letter-spacing:.04em}
        .dir-btn.active{background:#f97316;border-color:#f97316;color:#000;font-weight:bold}
        .bar-bg{background:#222;border-radius:4px;height:5px;overflow:hidden;margin-top:10px}
        .bar-fill{height:100%;border-radius:4px;transition:width .5s ease}
        .pill{font-size:10px;padding:2px 9px;border-radius:50px;letter-spacing:.07em;text-transform:uppercase}
        .pill.next{background:#f9731622;color:#f97316;border:1px solid #f9731644}
        .pill.double{background:#fb923c22;color:#fb923c;border:1px solid #fb923c44}
        .pill.mine-p{background:#f9731622;color:#f97316;border:1px solid #f9731655}
        .btn{font-size:11px;letter-spacing:.07em;text-transform:uppercase;border-radius:50px;padding:5px 14px;cursor:pointer;font-family:'DM Mono',monospace;transition:all .15s;border:1px solid}
        .btn-join{color:#f97316;background:transparent;border-color:#f9731655}
        .btn-join:hover{background:#f9731622}
        .btn-leave{color:#ef4444;background:transparent;border-color:#ef444455}
        .btn-leave:hover{background:#ef444422}
        .btn-fb{color:#666;background:transparent;border-color:#333;font-size:11px}
        .btn-fb:hover{border-color:#555;color:#999}
        .fb-panel{background:#0d0d0d;border:1px solid #222;border-radius:12px;padding:14px;margin-top:10px}
        .fb-opt{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background .12s;border:1px solid transparent;font-size:13px;color:#ccc}
        .fb-opt:hover{background:#1a1a1a;border-color:#333}
        .fb-opt.selected{background:#f9731618;border-color:#f9731644;color:#f97316}
        .pred-box{background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px;padding:8px 12px;margin-top:8px;display:flex;align-items:center;justify-content:space-between}
        .rel-box{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:2px 8px;border-radius:50px;letter-spacing:.05em}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #f9731644;color:#f97316;padding:10px 20px;border-radius:50px;font-size:12px;letter-spacing:.05em;animation:fadeup .3s ease;z-index:100;white-space:nowrap}
        @keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .section-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#444;margin:22px 0 10px}
      `}</style>

      <div style={{ background: "#0f0f0f", borderBottom: "1px solid #222", padding: "18px 20px 14px", width: "100%" }}>
        <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 36, color: "#f97316", letterSpacing: "-0.03em" }}>59</span>
            <div>
              <div style={{ fontSize: 13, color: "#aaa" }}>TPER Bologna</div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: ".1em", textTransform: "uppercase" }}>{dayLabel} · live</div>
            </div>
          </div>
          <button onClick={() => { try { sessionStorage.removeItem("bus59_auth"); } catch {} setUnlocked(false); }}
            style={{ background: "transparent", border: "1px solid #222", borderRadius: 8, padding: "6px 12px", color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
            sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "18px 14px 60px", width: "100%" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button className={`dir-btn ${direction === "to" ? "active" : ""}`} onClick={() => setDirection("to")}>P. Cavour → Villa</button>
          <button className={`dir-btn ${direction === "from" ? "active" : ""}`} onClick={() => setDirection("from")}>Villa → P. Cavour</button>
        </div>

        {!isWeekday() && !isSaturday() && <div style={{ color: "#ef4444", fontSize: 14 }}>No service on Sundays.</div>}

        {upcoming.length > 0 && <>
          <div className="section-label">Upcoming buses</div>
          {upcoming.map(({ time, double }, i) => {
            const key = cKey(time);
            const fkey = fKey(time);
            const hkey = hKey(time);
            const count = counts[key]?.count || 0;
            const cap = double ? CAPACITY * 2 : CAPACITY;
            const occ = occupancyInfo(count, double);
            const mine = myBus === key;
            const isNext = i === 0;
            const minsLeft = timeToMins(time) - now;
            const pct = Math.min(100, (count / cap) * 100);
            const fbData = feedbacks[fkey] || {};
            const histData = history[hkey] || null;
            const prediction = getPrediction(histData, double);
            const reliability = getReliability(histData);
            const myFbKey = `${direction}:${time}`;
            const myFb = myFeedbacks[myFbKey];
            const totalFb = Object.values(fbData).reduce((a, b) => a + (Number(b) || 0), 0);
            const fbOpen = feedbackOpen === key;

            return (
              <div key={key} className={`card upcoming ${mine ? "mine" : ""}`} style={{ marginBottom: 10 }}
                onClick={() => !fbOpen && toggleBus(time)}>

                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#f97316", letterSpacing: "-0.02em" }}>{time}</span>
                      {isNext && <span className="pill next pulse">next</span>}
                      {double && <span className="pill double">🚌🚌 double</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {minsLeft <= 0 ? "⚡ departing" : `in ${minsLeft} min`} · {count}/{cap} people
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, color: occ.color }}>{count}</div>
                    <div style={{ fontSize: 18 }}>{occ.dot}</div>
                    <div style={{ fontSize: 10, color: occ.color, letterSpacing: ".05em", textTransform: "uppercase" }}>{occ.label}</div>
                  </div>
                </div>

                {/* Live bar */}
                <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%`, background: "#f97316" }} /></div>

                {/* Prediction + reliability row */}
                {(prediction || reliability) && (
                  <div className="pred-box" onClick={e => e.stopPropagation()}>
                    {prediction && (
                      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>
                          Historical prediction
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14 }}>{prediction.dot}</span>
                          <span style={{ fontSize: 12, color: prediction.color }}>{prediction.label}</span>
                          <span style={{ fontSize: 10, color: "#444" }}>
                            ({histData?.total_reports} reports)
                          </span>
                        </div>
                        {/* Prediction bar */}
                        <div style={{ background: "#1a1a1a", borderRadius: 4, height: 3, marginTop: 2, overflow: "hidden" }}>
                          <div style={{ width: `${prediction.pct * 100}%`, height: "100%", background: prediction.color, borderRadius: 4, transition: "width .5s" }} />
                        </div>
                      </div>
                    )}
                    {reliability && (
                      <div style={{ marginLeft: 12, textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 3 }}>Reliability</div>
                        <span className="rel-box" style={{ background: `${reliability.color}18`, border: `1px solid ${reliability.color}44`, color: reliability.color }}>
                          {reliability.icon} {reliability.label}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {mine
                      ? <><span className="pill mine-p">✓ I'm on this</span><button className="btn btn-leave" onClick={() => toggleBus(time)}>Leave</button></>
                      : <button className="btn btn-join" onClick={e => { e.stopPropagation(); toggleBus(time); }}>I'm taking this</button>}
                  </div>
                  <button className="btn btn-fb" onClick={e => { e.stopPropagation(); setFeedbackOpen(fbOpen ? null : key); }}>
                    {totalFb > 0 ? `${totalFb} feedback` : "Give feedback"} ›
                  </button>
                </div>

                {/* Feedback panel */}
                {fbOpen && (
                  <div className="fb-panel" onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
                      How was the bus? · Helps future predictions
                    </div>
                    {FEEDBACK_OPTIONS.map(opt => {
                      const votes = fbData[opt.id] || 0;
                      const selected = myFb === opt.id;
                      return (
                        <div key={opt.id} className={`fb-opt ${selected ? "selected" : ""}`} onClick={() => submitFeedback(time, opt.id)}>
                          <span style={{ fontSize: 16 }}>{opt.icon}</span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {votes > 0 && <span style={{ fontSize: 11, color: "#555", background: "#1a1a1a", padding: "2px 8px", borderRadius: 50 }}>{votes}</span>}
                          {selected && <span style={{ fontSize: 12, color: "#f97316" }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>}

        {past.length > 0 && <>
          <div className="section-label">Past buses</div>
          {past.slice(-4).map(({ time, double }) => {
            const key = cKey(time);
            const hkey = hKey(time);
            const histData = history[hkey] || null;
            const reliability = getReliability(histData);
            return (
              <div key={key} className="card past" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: "#f97316" }}>{time}</span>
                  {double && <span className="pill double" style={{ fontSize: 9 }}>🚌🚌</span>}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {reliability && (
                    <span className="rel-box" style={{ background: `${reliability.color}18`, border: `1px solid ${reliability.color}33`, color: reliability.color }}>
                      {reliability.icon} {reliability.label}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#444" }}>{counts[key]?.count || 0} people</span>
                </div>
              </div>
            );
          })}
        </>}

        <div style={{ marginTop: 32, fontSize: 10, color: "#222", textAlign: "center", lineHeight: 2, letterSpacing: ".05em", textTransform: "uppercase" }}>
          Live shared data · Predictions improve with feedback
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}