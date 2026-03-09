import { useState, useEffect, useCallback } from "react";

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

function todayDate() {
  return new Date().toISOString().split("T")[0]; // "2026-03-10"
}

function getDayName() {
  const days = ["sun","mon","tue","wed","thu","fri","sat"];
  return days[new Date().getDay()];
}

async function sbUpsert(table, id, payload) {
  const date = todayDate();
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id, date, ...payload }),
  });
}

async function sbGetAll(table) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return await r.json();
}

async function sbGetToday(table) {
  const date = todayDate();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?date=eq.${date}&select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return await r.json();
}

const BASELINE_TRIP = {
  "to": { "07:15":10,"08:10":10,"08:40":10,"09:10":10,"09:40":10,"12:45":10,"13:45":10,"14:15":10,"14:45":10,"16:45":15,"17:20":20,"17:45":20,"18:10":20,"18:45":15,"20:00":10 },
  "from": { "07:25":10,"08:20":10,"08:50":10,"09:20":10,"09:50":10,"13:10":10,"13:55":10,"14:25":10,"14:55":10,"17:10":20,"17:30":20,"17:40":20,"18:10":20,"18:20":20,"18:30":15,"19:10":10,"20:10":10 }
};

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
  { time: "17:40", double: true },  { time: "18:10", double: false },
  { time: "18:20", double: false }, { time: "18:30", double: true },
  { time: "19:10", double: false }, { time: "20:10", double: false },
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
function minsToTime(m) { const h = Math.floor(m/60); const min = m%60; return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`; }
function minsNow() { const { h, m } = getNow(); return h * 60 + m; }
function isWeekday() { const d = getNow().day; return d >= 1 && d <= 5; }
function isSaturday() { return getNow().day === 6; }

const CAPACITY = 40;

function occupancyInfo(count, double) {
  const cap = double ? CAPACITY * 2 : CAPACITY;
  const pct = count / cap;
  if (pct < 0.4) return { label: "Comfortable", color: "#f97316", dot: "🟢" };
  if (pct < 0.75) return { label: "Busy", color: "#fb923c", dot: "🟡" };
  return { label: "Full", color: "#fff", dot: "🔴" };
}

// Aggregate all historical rows for this slot + day-of-week
function getPrediction(historyRows, slotId, double) {
  const day = getDayName();
  // Filter to same slot and same day of week across all dates
  const relevant = historyRows.filter(r =>
    r.id === slotId && new Date(r.date).getDay() === new Date().getDay()
  );
  if (relevant.length === 0) return null;
  const totals = relevant.reduce((acc, r) => ({
    more_crowded: acc.more_crowded + (r.more_crowded || 0),
    less_crowded: acc.less_crowded + (r.less_crowded || 0),
    total_reports: acc.total_reports + (r.total_reports || 0),
  }), { more_crowded: 0, less_crowded: 0, total_reports: 0 });

  if (totals.total_reports < 3) return null;
  const score = (totals.more_crowded - totals.less_crowded) / totals.total_reports;
  const predictedPct = Math.max(0.05, Math.min(0.98, 0.35 + score * 0.55));
  const totalReports = totals.total_reports;
  if (predictedPct < 0.4) return { label: "Likely comfortable", dot: "🟢", color: "#4ade80", pct: predictedPct, totalReports };
  if (predictedPct < 0.75) return { label: "Likely busy", dot: "🟡", color: "#facc15", pct: predictedPct, totalReports };
  return { label: "Likely full", dot: "🔴", color: "#f87171", pct: predictedPct, totalReports };
}

function getReliability(historyRows, slotId) {
  const relevant = historyRows.filter(r =>
    r.id === slotId && new Date(r.date).getDay() === new Date().getDay()
  );
  if (relevant.length === 0) return null;
  const totals = relevant.reduce((acc, r) => ({
    no_show: acc.no_show + (r.no_show || 0),
    two_buses: acc.two_buses + (r.two_buses || 0),
    total_reports: acc.total_reports + (r.total_reports || 0),
  }), { no_show: 0, two_buses: 0, total_reports: 0 });
  if (totals.total_reports < 3) return null;
  const score = Math.round(((totals.total_reports - totals.no_show - totals.two_buses) / totals.total_reports) * 10);
  if (score >= 8) return { score, label: `${score}/10 reliable`, color: "#4ade80", icon: "✓" };
  if (score >= 5) return { score, label: `${score}/10 reliable`, color: "#facc15", icon: "⚠" };
  return { score, label: `${score}/10 reliable`, color: "#f87171", icon: "✗" };
}

function getETA(arrivalRows, slotId, direction, time) {
  const baseline = BASELINE_TRIP[direction]?.[time] || 10;
  const relevant = arrivalRows.filter(r =>
    r.id === slotId && new Date(r.date).getDay() === new Date().getDay()
  );
  let avgDelay = 0, avgTrip = baseline;
  const totalDelayReports = relevant.reduce((a, r) => a + (r.delay_report_count || 0), 0);
  const totalTripReports = relevant.reduce((a, r) => a + (r.trip_report_count || 0), 0);
  const totalDelayMins = relevant.reduce((a, r) => a + (r.total_delay_minutes || 0), 0);
  const totalTripMins = relevant.reduce((a, r) => a + (r.total_trip_minutes || 0), 0);
  if (totalDelayReports >= 2) avgDelay = Math.round(totalDelayMins / totalDelayReports);
  if (totalTripReports >= 2) avgTrip = Math.round(totalTripMins / totalTripReports);
  const scheduledMins = timeToMins(time);
  const estArrivalAtStop = scheduledMins + avgDelay;
  const estArrivalAtEnd = estArrivalAtStop + avgTrip;
  return {
    avgDelay, avgTrip,
    estArrivalAtStop: minsToTime(estArrivalAtStop),
    estArrivalAtEnd: minsToTime(estArrivalAtEnd),
    hasRealData: totalDelayReports >= 2 || totalTripReports >= 2,
    delayReports: totalDelayReports,
    tripReports: totalTripReports,
    baseline,
  };
}

const FEEDBACK_OPTIONS = [
  { id: "more_crowded", label: "More crowded than shown 😬", icon: "📈" },
  { id: "less_crowded", label: "Emptier than shown 😌", icon: "📉" },
  { id: "two_buses", label: "Two buses came 🚌🚌", icon: "🚌" },
  { id: "no_show", label: "Bus didn't show up 👻", icon: "👻" },
];
const DELAY_OPTIONS = [0, 5, 10, 15, 20];

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
    <div style={{ minHeight:"100vh",width:"100%",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono','Courier New',monospace",padding:24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;min-height:100vh;margin:0;padding:0;background:#0a0a0a}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .shake{animation:shake .4s ease}
        @keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .lock-box{animation:fadein .5s ease}
      `}</style>
      <div className="lock-box" style={{ width:"100%",maxWidth:340,textAlign:"center" }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:72,color:"#f97316",letterSpacing:"-0.03em",marginBottom:4 }}>59</div>
        <div style={{ fontSize:11,color:"#444",letterSpacing:".15em",textTransform:"uppercase",marginBottom:48 }}>TPER Bologna · Restricted Access</div>
        <div style={{ fontSize:32,marginBottom:24 }}>🔑</div>
        <div className={shake ? "shake" : ""}>
          <input type="password" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && attempt()} placeholder="password" autoFocus
            style={{ width:"100%",background:"#111",border:`1.5px solid ${error?"#ef4444":"#333"}`,borderRadius:10,padding:"14px 18px",color:"#fff",fontSize:16,fontFamily:"'DM Mono',monospace",letterSpacing:".15em",outline:"none",textAlign:"center",transition:"border-color .2s",marginBottom:12 }} />
          {error && <div style={{ fontSize:12,color:"#ef4444",marginBottom:12 }}>Wrong password. Try again.</div>}
          <button onClick={attempt} style={{ width:"100%",background:"#f97316",border:"none",borderRadius:10,padding:"14px",color:"#000",fontSize:13,fontFamily:"'DM Mono',monospace",letterSpacing:".1em",textTransform:"uppercase",cursor:"pointer",fontWeight:"bold" }}>
            Enter →
          </button>
        </div>
        <div style={{ marginTop:40,fontSize:10,color:"#333",letterSpacing:".08em",textTransform:"uppercase" }}>Ask your group for the password</div>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [direction, setDirection] = useState("to");
  const [counts, setCounts] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [historyRows, setHistoryRows] = useState([]);
  const [arrivalRows, setArrivalRows] = useState([]);
  const [myBus, setMyBus] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(null);
  const [etaOpen, setEtaOpen] = useState(null);
  const [myFeedbacks, setMyFeedbacks] = useState({});
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const [selectedTo, setSelectedTo] = useState(null);
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    try { if (localStorage.getItem("bus59_auth") === APP_PASSWORD) setUnlocked(true); } catch {}
  }, []);

  const handleUnlock = () => {
    try { localStorage.setItem("bus59_auth", APP_PASSWORD); } catch {}
    setUnlocked(true);
  };

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === "mybus59") setMyBus(e.newValue || null); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = useCallback(async () => {
    try {
      const [countRows, fbRows, histRows, arrRows] = await Promise.all([
        sbGetToday("bus_counts"),
        sbGetToday("bus_feedbacks"),
        sbGetAll("bus_history"),   // all dates for predictions
        sbGetAll("bus_arrivals"),  // all dates for ETA averages
      ]);
      const c = {}, f = {};
      countRows.forEach(r => c[r.id] = { count: r.count });
      fbRows.forEach(r => f[r.id] = r.data);
      setCounts(c);
      setFeedbacks(f);
      setHistoryRows(histRows);
      setArrivalRows(arrRows);
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
      const b = localStorage.getItem("mybus59"); if (b) setMyBus(b);
      const f = localStorage.getItem("myfeedbacks59"); if (f) setMyFeedbacks(JSON.parse(f));
    } catch {}
  }, [unlocked]);

  // Auto-expand selected bus for current direction when direction changes
  useEffect(() => {
    const currentSelected = direction === "to" ? selectedTo : selectedFrom;
    setExpanded(currentSelected);
  }, [direction, selectedTo, selectedFrom]);

  const getSchedule = () => {
    const wd = isWeekday(), sat = isSaturday();
    if (!wd && !sat) return [];
    if (direction === "to") return wd ? WEEKDAY_TO_VILLA : SAT_TO_VILLA;
    return wd ? WEEKDAY_FROM_VILLA : SAT_FROM_VILLA;
  };

  const cKey = (time) => `${direction}:${time}`;
  const fKey = (time) => `fb:${direction}:${time}`;
  const slotId = (time) => `${direction}:${time}`;

  const toggleBus = async (time) => {
    const key = cKey(time);
    const isMe = myBus === key;
    const existing = counts[key]?.count || 0;
    if (isMe) {
      const newCount = Math.max(0, existing - 1);
      setCounts(prev => ({ ...prev, [key]: { count: newCount } }));
      setMyBus(null);
      try { localStorage.setItem("mybus59", ""); } catch {}
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
      try { localStorage.setItem("mybus59", key); } catch {}
      await sbUpsert("bus_counts", key, { count: newCount });
      showToast("✓ Added to this bus");
    }
  };

  const submitFeedback = async (time, fbId) => {
    const key = fKey(time);
    const sid = slotId(time);
    const myFbKey = `${direction}:${time}`;
    const alreadyMine = myFeedbacks[myFbKey] === fbId;
    const existing = feedbacks[key] || {};
    const updated = { ...existing };

    // Find today's history row for this slot
    const today = todayDate();
    const todayHist = historyRows.find(r => r.id === sid && r.date === today) ||
      { id: sid, date: today, more_crowded:0, less_crowded:0, no_show:0, two_buses:0, total_reports:0 };
    const updatedHist = { ...todayHist };

    if (alreadyMine) {
      updated[fbId] = Math.max(0, (updated[fbId] || 1) - 1);
      updatedHist[fbId] = Math.max(0, (updatedHist[fbId] || 1) - 1);
      updatedHist.total_reports = Math.max(0, updatedHist.total_reports - 1);
      const newMy = { ...myFeedbacks }; delete newMy[myFbKey];
      setMyFeedbacks(newMy);
      try { localStorage.setItem("myfeedbacks59", JSON.stringify(newMy)); } catch {}
    } else {
      const oldFb = myFeedbacks[myFbKey];
      if (oldFb) {
        updated[oldFb] = Math.max(0, (updated[oldFb] || 1) - 1);
        updatedHist[oldFb] = Math.max(0, (updatedHist[oldFb] || 1) - 1);
        updatedHist.total_reports = Math.max(0, updatedHist.total_reports - 1);
      }
      updated[fbId] = (updated[fbId] || 0) + 1;
      updatedHist[fbId] = (updatedHist[fbId] || 0) + 1;
      updatedHist.total_reports = updatedHist.total_reports + 1;
      const newMy = { ...myFeedbacks, [myFbKey]: fbId };
      setMyFeedbacks(newMy);
      try { localStorage.setItem("myfeedbacks59", JSON.stringify(newMy)); } catch {}
      showToast("Feedback saved — helps future predictions 📊");
    }

    setFeedbacks(prev => ({ ...prev, [key]: updated }));
    setHistoryRows(prev => {
      const filtered = prev.filter(r => !(r.id === sid && r.date === today));
      return [...filtered, updatedHist];
    });
    setFeedbackOpen(null);

    await Promise.all([
      sbUpsert("bus_feedbacks", key, { data: updated }),
      sbUpsert("bus_history", sid, {
        more_crowded: updatedHist.more_crowded,
        less_crowded: updatedHist.less_crowded,
        no_show: updatedHist.no_show,
        two_buses: updatedHist.two_buses,
        total_reports: updatedHist.total_reports,
      }),
    ]);
  };

  const submitArrivalDelay = async (time, delayMins) => {
    const sid = slotId(time);
    const today = todayDate();
    const existing = arrivalRows.find(r => r.id === sid && r.date === today) ||
      { id: sid, date: today, total_delay_minutes:0, delay_report_count:0, total_trip_minutes:0, trip_report_count:0 };
    const updated = {
      ...existing,
      total_delay_minutes: existing.total_delay_minutes + delayMins,
      delay_report_count: existing.delay_report_count + 1,
    };
    setArrivalRows(prev => [...prev.filter(r => !(r.id === sid && r.date === today)), updated]);
    setEtaOpen(null);
    showToast(delayMins === 0 ? "✓ On time reported!" : `✓ +${delayMins} min delay reported`);
    await sbUpsert("bus_arrivals", sid, {
      total_delay_minutes: updated.total_delay_minutes,
      delay_report_count: updated.delay_report_count,
      total_trip_minutes: updated.total_trip_minutes,
      trip_report_count: updated.trip_report_count,
    });
  };

  const submitTripDuration = async (time, extraMins) => {
    const sid = slotId(time);
    const today = todayDate();
    const baseline = BASELINE_TRIP[direction]?.[time] || 10;
    const totalMins = baseline + extraMins;
    const existing = arrivalRows.find(r => r.id === sid && r.date === today) ||
      { id: sid, date: today, total_delay_minutes:0, delay_report_count:0, total_trip_minutes:0, trip_report_count:0 };
    const updated = {
      ...existing,
      total_trip_minutes: existing.total_trip_minutes + totalMins,
      trip_report_count: existing.trip_report_count + 1,
    };
    setArrivalRows(prev => [...prev.filter(r => !(r.id === sid && r.date === today)), updated]);
    setEtaOpen(null);
    showToast(extraMins === 0 ? "✓ Trip on schedule!" : `✓ +${extraMins} min longer trip reported`);
    await sbUpsert("bus_arrivals", sid, {
      total_delay_minutes: updated.total_delay_minutes,
      delay_report_count: updated.delay_report_count,
      total_trip_minutes: updated.total_trip_minutes,
      trip_report_count: updated.trip_report_count,
    });
  };

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  // Focus mode logic
  const selected = direction === "to" ? selectedTo : selectedFrom; // current booked choice for this direction
  const bothSelected = selectedTo && selectedFrom;
  
  const handleExpand = (time) => {
    setExpanded(prev => (prev === time ? null : time));
  };

  const schedule = getSchedule().sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
  const now = minsNow() + tick * 0;
  const upcoming = schedule.filter(b => timeToMins(b.time) >= now - 5);
  const past = schedule.filter(b => timeToMins(b.time) < now - 5);
  const dayLabel = isWeekday() ? "Mon–Fri" : isSaturday() ? "Saturday" : "Sunday";

  return (
    <div style={{ minHeight:"100vh",width:"100%",background:"#0a0a0a",fontFamily:"'DM Mono','Courier New',monospace",color:"#e8e8e8" }}>
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
        .btn-eta{color:#38bdf8;background:transparent;border-color:#38bdf844;font-size:11px}
        .btn-eta:hover{background:#38bdf811}
        .fb-panel{background:#0d0d0d;border:1px solid #222;border-radius:12px;padding:14px;margin-top:10px}
        .fb-opt{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background .12s;border:1px solid transparent;font-size:13px;color:#ccc}
        .fb-opt:hover{background:#1a1a1a;border-color:#333}
        .fb-opt.selected{background:#f9731618;border-color:#f9731644;color:#f97316}
        .eta-panel{background:#0d0d0d;border:1px solid #1a2a33;border-radius:12px;padding:14px;margin-top:10px}
        .delay-btn{padding:7px 14px;border-radius:50px;border:1px solid #1e3a4a;background:transparent;color:#38bdf8;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s}
        .delay-btn:hover{background:#38bdf822;border-color:#38bdf8}
        .pred-box{background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px;padding:8px 12px;margin-top:8px;display:flex;align-items:center;justify-content:space-between}
        .rel-box{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:2px 8px;border-radius:50px;letter-spacing:.05em}
        .eta-box{background:#0d1a22;border:1px solid #1e3a4a;border-radius:8px;padding:10px 14px;margin-top:8px}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #f9731644;color:#f97316;padding:10px 20px;border-radius:50px;font-size:12px;letter-spacing:.05em;animation:fadeup .3s ease;z-index:100;white-space:nowrap}
        @keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .section-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#444;margin:22px 0 10px}
      `}</style>

      <div style={{ background:"#0f0f0f",borderBottom:"1px solid #222",padding:"18px 20px 14px",width:"100%" }}>
        <div style={{ maxWidth:500,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"baseline",gap:12 }}>
            <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:36,color:"#f97316",letterSpacing:"-0.03em" }}>59</span>
            <div>
              <div style={{ fontSize:13,color:"#aaa" }}>TPER Bologna</div>
              <div style={{ fontSize:10,color:"#555",letterSpacing:".1em",textTransform:"uppercase" }}>{dayLabel} · live</div>
            </div>
          </div>
          <button onClick={() => { try { localStorage.removeItem("bus59_auth"); } catch {} setUnlocked(false); }}
            style={{ background:"transparent",border:"1px solid #222",borderRadius:8,padding:"6px 12px",color:"#555",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace" }}>
            sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth:500,margin:"0 auto",padding:"18px 14px 60px",width:"100%" }}>
        <div style={{ display:"flex",gap:8,marginBottom:20 }}>
          <button className={`dir-btn ${direction==="to"?"active":""}`} onClick={() => setDirection("to")}>P. Cavour → Villa</button>
          <button className={`dir-btn ${direction==="from"?"active":""}`} onClick={() => setDirection("from")}>Villa → P. Cavour</button>
        </div>

        {!isWeekday() && !isSaturday() && <div style={{ color:"#ef4444",fontSize:14 }}>No service on Sundays.</div>}
        {(selectedTo || selectedFrom) && !bothSelected && (
          <div style={{ fontSize:12,color:"#aaa",margin:"10px 0" }}>
            {selectedTo && "You selected a trip from P. Cavour"}
            {selectedFrom && "You selected a trip from Villa"}
          </div>
        )}

        {upcoming.length > 0 && <>
          <div className="section-label">Upcoming buses</div>
          {upcoming.map(({ time, double }, i) => {
            const key = cKey(time);
            const fkey = fKey(time);
            const sid = slotId(time);
            const count = counts[key]?.count || 0;
            const cap = double ? CAPACITY * 2 : CAPACITY;
            const occ = occupancyInfo(count, double);
            const mine = myBus === key;
            const isNext = i === 0;
            const minsLeft = timeToMins(time) - now;
            const pct = Math.min(100, (count / cap) * 100);
            const fbData = feedbacks[fkey] || {};
            const prediction = getPrediction(historyRows, sid, double);
            const reliability = getReliability(historyRows, sid);
            const eta = getETA(arrivalRows, sid, direction, time);
            const myFbKey = `${direction}:${time}`;
            const myFb = myFeedbacks[myFbKey];
            const totalFb = Object.values(fbData).reduce((a, b) => a + (Number(b)||0), 0);
            const fbOpen = feedbackOpen === key;
            const showArrivalButton = Math.abs(minsLeft) <= 20;
            const showTripButton = minsLeft <= -7 && minsLeft >= -60;
            const etaPanelOpen = etaOpen?.key === key;
            const isExpanded = expanded === time;

            // Compact card (browse mode or collapsed when another selected)
            if (!expanded && !isExpanded) {
              return (
                <div key={key} className={`card upcoming ${mine?"mine":""}`} style={{ marginBottom:8,cursor:"pointer",padding:"12px 14px" }}
                  onClick={() => handleExpand(time)}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12,flex:1 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:"#f97316" }}>{time}</span>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ fontSize:18 }}>{occ.dot}</span>
                        <span style={{ fontSize:11,color:"#888" }}>{occ.label}</span>
                        {prediction && <span style={{ fontSize:11,color:prediction.color }}>{prediction.label}</span>}
                      </div>
                    </div>
                    {isNext && <span className="pill next pulse">next</span>}
                  </div>
                </div>
              );
            }

            // One-line card (other card when this one selected)
            if (expanded && !isExpanded) {
              return (
                <div key={key} className="card upcoming" style={{ marginBottom:6,opacity:0.5,padding:"10px 14px",cursor:"pointer" }}
                  onClick={() => handleExpand(time)}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11 }}>
                    <span style={{ color:"#f97316",fontWeight:"bold" }}>{time}</span>
                    <span style={{ color:"#666" }}>{occ.dot} {occ.label}</span>
                  </div>
                </div>
              );
            }

            // Full card (selected mode)
            return (
              <div key={key} className={`card upcoming ${mine?"mine":""}`} style={{ marginBottom:10 }}>
                {expanded && (
                  <button onClick={() => handleExpand(time)} style={{ display:"block",margin:"0 0 12px",background:"transparent",border:"none",color:"#666",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace" }}>
                    ← Back to buses
                  </button>
                )}

                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:"#f97316",letterSpacing:"-0.02em" }}>{time}</span>
                      {isNext && <span className="pill next pulse">next</span>}
                      {double && <span className="pill double">🚌🚌 double</span>}
                    </div>
                    <div style={{ fontSize:11,color:"#888" }}>
                      {minsLeft <= 0 ? "⚡ departing" : `in ${minsLeft} min`} · {count}/{cap} people
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:occ.color }}>{count}</div>
                    <div style={{ fontSize:18 }}>{occ.dot}</div>
                    <div style={{ fontSize:10,color:occ.color,letterSpacing:".05em",textTransform:"uppercase" }}>{occ.label}</div>
                  </div>
                </div>

                <div className="bar-bg"><div className="bar-fill" style={{ width:`${pct}%`,background:"#f97316" }} /></div>

                <div className="eta-box" onClick={e => e.stopPropagation()}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10,color:"#38bdf8",letterSpacing:".08em",textTransform:"uppercase",marginBottom:6 }}>
                        ⏱ ETA {eta.hasRealData ? `· ${eta.delayReports + eta.tripReports} reports` : "· baseline only"}
                      </div>
                      <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
                        <div>
                          <div style={{ fontSize:10,color:"#555",marginBottom:2 }}>Arrives at stop</div>
                          <div style={{ fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:700,color:eta.avgDelay>0?"#facc15":"#4ade80" }}>
                            {eta.estArrivalAtStop}
                            {eta.avgDelay > 0 && <span style={{ fontSize:11,color:"#facc15",marginLeft:4 }}>+{eta.avgDelay}min</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:10,color:"#555",marginBottom:2 }}>Arrives at end</div>
                          <div style={{ fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:700,color:eta.avgTrip>eta.baseline?"#facc15":"#4ade80" }}>
                            {eta.estArrivalAtEnd}
                            <span style={{ fontSize:11,color:"#555",marginLeft:4 }}>{eta.avgTrip}min ride</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {etaPanelOpen && etaOpen?.type === "delay" && (
                    <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #1e3a4a" }}>
                      <div style={{ fontSize:11,color:"#38bdf8",letterSpacing:".08em",textTransform:"uppercase",marginBottom:8 }}>How late was the bus?</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        {DELAY_OPTIONS.map(d => (
                          <button key={d} className="delay-btn" onClick={() => submitArrivalDelay(time, d)}>
                            {d === 0 ? "On time" : `+${d} min`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {etaPanelOpen && etaOpen?.type === "trip" && (
                    <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #1e3a4a" }}>
                      <div style={{ fontSize:11,color:"#38bdf8",letterSpacing:".08em",textTransform:"uppercase",marginBottom:4 }}>How long was the ride?</div>
                      <div style={{ fontSize:10,color:"#555",marginBottom:8 }}>Scheduled: {eta.baseline} min. Extra time?</div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        {DELAY_OPTIONS.map(d => (
                          <button key={d} className="delay-btn" onClick={() => submitTripDuration(time, d)}>
                            {d === 0 ? "On time" : `+${d} min`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {(showArrivalButton || showTripButton) && (
                  <div style={{ background:"#0d1a22",border:"1px solid #1e3a4a",borderRadius:8,padding:12,marginTop:8 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize:10,color:"#38bdf8",letterSpacing:".08em",textTransform:"uppercase",marginBottom:10 }}>Report departure & arrival</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {showArrivalButton && (
                        <button className="btn btn-eta"
                          onClick={e => { e.stopPropagation(); setEtaOpen(etaPanelOpen && etaOpen?.type==="delay" ? null : { key, type:"delay" }); }}
                          style={{ width:"100%",justifyContent:"center",fontSize:12,padding:"8px 12px" }}>
                          🚌 Just arrived
                        </button>
                      )}
                      {showTripButton && (
                        <button className="btn btn-eta"
                          onClick={e => { e.stopPropagation(); setEtaOpen(etaPanelOpen && etaOpen?.type==="trip" ? null : { key, type:"trip" }); }}
                          style={{ width:"100%",justifyContent:"center",fontSize:12,padding:"8px 12px" }}>
                          🏁 Just got off
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {(prediction || reliability) && (
                  <div className="pred-box" onClick={e => e.stopPropagation()}>
                    {prediction && (
                      <div style={{ display:"flex",flex:1,flexDirection:"column",gap:3 }}>
                        <div style={{ fontSize:10,color:"#555",letterSpacing:".08em",textTransform:"uppercase" }}>Historical prediction</div>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ fontSize:14 }}>{prediction.dot}</span>
                          <span style={{ fontSize:12,color:prediction.color }}>{prediction.label}</span>
                          <span style={{ fontSize:10,color:"#444" }}>({prediction.totalReports} reports)</span>
                        </div>
                        <div style={{ background:"#1a1a1a",borderRadius:4,height:3,marginTop:2,overflow:"hidden" }}>
                          <div style={{ width:`${prediction.pct*100}%`,height:"100%",background:prediction.color,borderRadius:4,transition:"width .5s" }} />
                        </div>
                      </div>
                    )}
                    {reliability && (
                      <div style={{ marginLeft:12,textAlign:"right" }}>
                        <div style={{ fontSize:10,color:"#555",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3 }}>Reliability</div>
                        <span className="rel-box" style={{ background:`${reliability.color}18`,border:`1px solid ${reliability.color}44`,color:reliability.color }}>
                          {reliability.icon} {reliability.label}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    {mine
                      ? <><span className="pill mine-p">✓ I'm on this</span><button className="btn btn-leave" onClick={() => { toggleBus(time); if (selected === time) { if (direction === "to") setSelectedTo(null); else setSelectedFrom(null); } }}>Leave</button></>
                      : <button className="btn btn-join" onClick={e => { e.stopPropagation(); toggleBus(time); if (direction === "to") setSelectedTo(time); else setSelectedFrom(time); }}>I'm taking this</button>}
                  </div>
                  <button className="btn btn-fb" onClick={e => { e.stopPropagation(); setFeedbackOpen(fbOpen ? null : key); }}>
                    {totalFb > 0 ? `${totalFb} feedback` : "Give feedback"} ›
                  </button>
                </div>

                {fbOpen && (
                  <div className="fb-panel" onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize:11,color:"#555",letterSpacing:".08em",textTransform:"uppercase",marginBottom:10 }}>How was the bus? · Helps future predictions</div>
                    {FEEDBACK_OPTIONS.map(opt => {
                      const votes = fbData[opt.id] || 0;
                      const selected = myFb === opt.id;
                      return (
                        <div key={opt.id} className={`fb-opt ${selected?"selected":""}`} onClick={() => submitFeedback(time, opt.id)}>
                          <span style={{ fontSize:16 }}>{opt.icon}</span>
                          <span style={{ flex:1 }}>{opt.label}</span>
                          {votes > 0 && <span style={{ fontSize:11,color:"#555",background:"#1a1a1a",padding:"2px 8px",borderRadius:50 }}>{votes}</span>}
                          {selected && <span style={{ fontSize:12,color:"#f97316" }}>✓</span>}
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
            const sid = slotId(time);
            const reliability = getReliability(historyRows, sid);
            return (
              <div key={key} className="card past" style={{ marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:"#f97316" }}>{time}</span>
                  {double && <span className="pill double" style={{ fontSize:9 }}>🚌🚌</span>}
                </div>
                <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                  {reliability && (
                    <span className="rel-box" style={{ background:`${reliability.color}18`,border:`1px solid ${reliability.color}33`,color:reliability.color }}>
                      {reliability.icon} {reliability.label}
                    </span>
                  )}
                  <span style={{ fontSize:12,color:"#444" }}>{counts[key]?.count || 0} people</span>
                </div>
              </div>
            );
          })}
        </>}

        <div style={{ marginTop:32,fontSize:10,color:"#222",textAlign:"center",lineHeight:2,letterSpacing:".05em",textTransform:"uppercase" }}>
          Live shared data · Predictions improve with reports
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}