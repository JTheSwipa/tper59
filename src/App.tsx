import { useState, useEffect, useCallback } from "react";

const APP_PASSWORD = "unibo2025"; // 🔑 CHANGE THIS before sharing

const WEEKDAY_TO_VILLA = [
  { time: "07:15", double: false },
  { time: "08:10", double: false },
  { time: "08:40", double: false },
  { time: "09:10", double: true },
  { time: "09:40", double: false },
  { time: "12:45", double: false },
  { time: "13:45", double: false },
  { time: "14:15", double: false },
  { time: "14:45", double: false },
  { time: "16:45", double: false },
  { time: "17:20", double: true },
  { time: "17:45", double: false },
  { time: "18:10", double: true },
  { time: "18:45", double: false },
  { time: "20:00", double: false },
];
const WEEKDAY_FROM_VILLA = [
  { time: "07:25", double: false },
  { time: "08:20", double: false },
  { time: "08:50", double: false },
  { time: "09:20", double: true },
  { time: "09:50", double: false },
  { time: "13:10", double: false },
  { time: "13:55", double: false },
  { time: "14:25", double: false },
  { time: "14:55", double: false },
  { time: "17:10", double: false },
  { time: "17:30", double: true },
  { time: "17:40", double: false },
  { time: "18:10", double: false },
  { time: "18:20", double: true },
  { time: "18:30", double: false },
  { time: "19:10", double: false },
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
const CAPACITY = 40;
function occupancyInfo(count, double) {
  const cap = double ? CAPACITY * 2 : CAPACITY;
  const pct = count / cap;
  if (pct < 0.4) return { label: "Comodo", color: "#4ade80", dot: "🟢" };
  if (pct < 0.75) return { label: "Affollato", color: "#facc15", dot: "🟡" };
  return { label: "Pieno", color: "#f87171", dot: "🔴" };
}
const FEEDBACK_OPTIONS = [
  { id: "more_crowded", label: "Era più affollato 😬", icon: "📈" },
  { id: "less_crowded", label: "Era più vuoto 😌", icon: "📉" },
  { id: "two_buses", label: "Sono arrivati due bus 🚌🚌", icon: "🚌" },
  { id: "no_show", label: "Il bus non è passato 👻", icon: "👻" },
];

function LockScreen({ onUnlock }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const attempt = () => {
    if (input === APP_PASSWORD) {
      onUnlock();
    } else {
      setShake(true);
      setError(true);
      setInput("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#09090f", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono','Courier New',monospace",
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .shake{animation:shake .4s ease}
        @keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .lock-box{animation:fadein .5s ease}
      `}</style>
      <div className="lock-box" style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 52, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>
          59
        </div>
        <div style={{ fontSize: 11, color: "#333", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 48 }}>
          TPER Bologna · Accesso riservato
        </div>

        <div style={{ fontSize: 32, marginBottom: 24 }}>🔑</div>

        <div className={shake ? "shake" : ""}>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && attempt()}
            placeholder="password"
            autoFocus
            style={{
              width: "100%",
              background: "#111118",
              border: `1.5px solid ${error ? "#f87171" : "#1e1e2e"}`,
              borderRadius: 10,
              padding: "14px 18px",
              color: "#fff",
              fontSize: 16,
              fontFamily: "'DM Mono',monospace",
              letterSpacing: ".15em",
              outline: "none",
              textAlign: "center",
              transition: "border-color .2s",
              marginBottom: 12,
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: "#f87171", letterSpacing: ".05em", marginBottom: 12 }}>
              Password errata. Riprova.
            </div>
          )}
          <button
            onClick={attempt}
            style={{
              width: "100%",
              background: "#6c63ff",
              border: "none",
              borderRadius: 10,
              padding: "14px",
              color: "#fff",
              fontSize: 13,
              fontFamily: "'DM Mono',monospace",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "opacity .15s",
            }}
            onMouseOver={e => e.target.style.opacity = ".85"}
            onMouseOut={e => e.target.style.opacity = "1"}
          >
            Entra →
          </button>
        </div>

        <div style={{ marginTop: 40, fontSize: 10, color: "#222", letterSpacing: ".08em", textTransform: "uppercase" }}>
          Chiedi la password al tuo gruppo
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [direction, setDirection] = useState("to");
  const [counts, setCounts] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [myBus, setMyBus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(null);
  const [myFeedbacks, setMyFeedbacks] = useState({});
  const [toast, setToast] = useState(null);

  // Persist unlock in sessionStorage so refresh doesn't log you out mid-session
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
      const [countKeys, fbKeys] = await Promise.all([
        window.storage.list("bus59c:", true).catch(() => ({ keys: [] })),
        window.storage.list("bus59f:", true).catch(() => ({ keys: [] })),
      ]);
      const allKeys = [...(countKeys.keys || []), ...(fbKeys.keys || [])];
      const results = await Promise.all(allKeys.map(k => window.storage.get(k, true).catch(() => null)));
      const c = {}, f = {};
      allKeys.forEach((k, i) => {
        if (!results[i]) return;
        try {
          const v = JSON.parse(results[i].value);
          if (k.startsWith("bus59c:")) c[k] = v;
          else if (k.startsWith("bus59f:")) f[k] = v;
        } catch {}
      });
      setCounts(c); setFeedbacks(f);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    loadAll();
    const id = setInterval(loadAll, 10000);
    return () => clearInterval(id);
  }, [loadAll, unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        const r = await window.storage.get("mybus59", false);
        if (r) setMyBus(r.value);
        const rf = await window.storage.get("myfeedbacks59", false);
        if (rf) setMyFeedbacks(JSON.parse(rf.value));
      } catch {}
    })();
  }, [unlocked]);

  const getSchedule = () => {
    const wd = isWeekday(), sat = isSaturday();
    if (!wd && !sat) return [];
    if (direction === "to") return wd ? WEEKDAY_TO_VILLA : SAT_TO_VILLA;
    return wd ? WEEKDAY_FROM_VILLA : SAT_FROM_VILLA;
  };

  const cKey = (time) => `bus59c:${direction}:${time}`;
  const fKey = (time) => `bus59f:${direction}:${time}`;

  const toggleBus = async (time) => {
    const key = cKey(time);
    const isMe = myBus === key;
    const existing = counts[key]?.count || 0;
    let newCount;
    if (isMe) {
      newCount = Math.max(0, existing - 1);
      await window.storage.set("mybus59", "", false).catch(() => {});
      setMyBus(null);
    } else {
      if (myBus && myBus !== key) {
        const oldNew = Math.max(0, (counts[myBus]?.count || 1) - 1);
        await window.storage.set(myBus, JSON.stringify({ count: oldNew }), true).catch(() => {});
        setCounts(prev => ({ ...prev, [myBus]: { count: oldNew } }));
      }
      newCount = existing + 1;
      await window.storage.set("mybus59", key, false).catch(() => {});
      setMyBus(key);
      showToast("✓ Aggiunto a questo bus");
    }
    await window.storage.set(key, JSON.stringify({ count: newCount }), true).catch(() => {});
    setCounts(prev => ({ ...prev, [key]: { count: newCount } }));
  };

  const submitFeedback = async (time, fbId) => {
    const key = fKey(time);
    const myFbKey = `${direction}:${time}`;
    const alreadyMine = myFeedbacks[myFbKey] === fbId;
    const existing = feedbacks[key] || {};
    const updated = { ...existing };
    if (alreadyMine) {
      updated[fbId] = Math.max(0, (updated[fbId] || 1) - 1);
      const newMy = { ...myFeedbacks }; delete newMy[myFbKey];
      setMyFeedbacks(newMy);
      await window.storage.set("myfeedbacks59", JSON.stringify(newMy), false).catch(() => {});
    } else {
      const oldFb = myFeedbacks[myFbKey];
      if (oldFb) updated[oldFb] = Math.max(0, (updated[oldFb] || 1) - 1);
      updated[fbId] = (updated[fbId] || 0) + 1;
      const newMy = { ...myFeedbacks, [myFbKey]: fbId };
      setMyFeedbacks(newMy);
      await window.storage.set("myfeedbacks59", JSON.stringify(newMy), false).catch(() => {});
      showToast("Feedback inviato 🙏");
    }
    await window.storage.set(key, JSON.stringify(updated), true).catch(() => {});
    setFeedbacks(prev => ({ ...prev, [key]: updated }));
    setFeedbackOpen(null);
  };

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  const schedule = getSchedule().sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
  const now = minsNow() + tick * 0;
  const upcoming = schedule.filter(b => timeToMins(b.time) >= now - 5);
  const past = schedule.filter(b => timeToMins(b.time) < now - 5);
  const dayLabel = isWeekday() ? "Lunedì–Venerdì" : isSaturday() ? "Sabato" : "Domenica";

  return (
    <div style={{ minHeight: "100vh", background: "#09090f", fontFamily: "'DM Mono','Courier New',monospace", color: "#e2e0ee" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .card{background:#111118;border:1px solid #1e1e2e;border-radius:14px;padding:16px 18px;transition:all .18s ease;position:relative}
        .card.mine{border-color:#6c63ff;background:#13122a}
        .card.past{opacity:.3}
        .card.upcoming{cursor:pointer}
        .card.upcoming:hover{border-color:#2e2e48;transform:translateY(-1px)}
        .dir-btn{padding:9px 18px;border-radius:50px;border:1.5px solid #222;background:transparent;color:#666;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s;letter-spacing:.04em}
        .dir-btn.active{background:#6c63ff;border-color:#6c63ff;color:#fff}
        .bar-bg{background:#1a1a28;border-radius:4px;height:5px;overflow:hidden;margin-top:10px}
        .bar-fill{height:100%;border-radius:4px;transition:width .5s ease}
        .pill{font-size:10px;padding:2px 9px;border-radius:50px;letter-spacing:.07em;text-transform:uppercase}
        .pill.next{background:#6c63ff22;color:#a89fff;border:1px solid #6c63ff44}
        .pill.double{background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b44}
        .pill.mine-p{background:#6c63ff22;color:#a89fff;border:1px solid #6c63ff55}
        .btn{font-size:11px;letter-spacing:.07em;text-transform:uppercase;border-radius:50px;padding:5px 14px;cursor:pointer;font-family:'DM Mono',monospace;transition:all .15s;border:1px solid}
        .btn-join{color:#6c63ff;background:transparent;border-color:#6c63ff55}
        .btn-join:hover{background:#6c63ff22}
        .btn-leave{color:#f87171;background:transparent;border-color:#f8717155}
        .btn-leave:hover{background:#f8717122}
        .btn-fb{color:#555;background:transparent;border-color:#222;font-size:11px}
        .btn-fb:hover{border-color:#444;color:#888}
        .fb-panel{background:#0e0e1a;border:1px solid #1e1e2e;border-radius:12px;padding:14px;margin-top:10px}
        .fb-opt{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background .12s;border:1px solid transparent;font-size:13px}
        .fb-opt:hover{background:#1a1a2a;border-color:#2a2a3a}
        .fb-opt.selected{background:#6c63ff18;border-color:#6c63ff44;color:#a89fff}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1e30;border:1px solid #333;color:#ccc;padding:10px 20px;border-radius:50px;font-size:12px;letter-spacing:.05em;animation:fadeup .3s ease;z-index:100;white-space:nowrap}
        @keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .section-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#333;margin:22px 0 10px}
      `}</style>

      <div style={{ background: "#0c0c14", borderBottom: "1px solid #161624", padding: "18px 20px 14px" }}>
        <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 36, color: "#fff", letterSpacing: "-0.03em" }}>59</span>
            <div>
              <div style={{ fontSize: 13, color: "#888" }}>TPER Bologna</div>
              <div style={{ fontSize: 10, color: "#333", letterSpacing: ".1em", textTransform: "uppercase" }}>{dayLabel} · live</div>
            </div>
          </div>
          <button onClick={() => { try { sessionStorage.removeItem("bus59_auth"); } catch {} setUnlocked(false); }}
            style={{ background: "transparent", border: "1px solid #1e1e2e", borderRadius: 8, padding: "6px 12px", color: "#333", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace", letterSpacing: ".05em" }}>
            esci
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "18px 14px 60px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button className={`dir-btn ${direction === "to" ? "active" : ""}`} onClick={() => setDirection("to")}>P. Cavour → Villa</button>
          <button className={`dir-btn ${direction === "from" ? "active" : ""}`} onClick={() => setDirection("from")}>Villa → P. Cavour</button>
        </div>

        {!isWeekday() && !isSaturday() && <div style={{ color: "#f87171", fontSize: 14 }}>Nessun servizio la domenica.</div>}

        {upcoming.length > 0 && <>
          <div className="section-label">Prossime corse</div>
          {upcoming.map(({ time, double }, i) => {
            const key = cKey(time);
            const fkey = fKey(time);
            const count = counts[key]?.count || 0;
            const cap = double ? CAPACITY * 2 : CAPACITY;
            const occ = occupancyInfo(count, double);
            const mine = myBus === key;
            const isNext = i === 0;
            const minsLeft = timeToMins(time) - now;
            const pct = Math.min(100, (count / cap) * 100);
            const fbData = feedbacks[fkey] || {};
            const myFbKey = `${direction}:${time}`;
            const myFb = myFeedbacks[myFbKey];
            const totalFb = Object.values(fbData).reduce((a, b) => a + b, 0);
            const fbOpen = feedbackOpen === key;

            return (
              <div key={key} className={`card upcoming ${mine ? "mine" : ""}`} style={{ marginBottom: 10 }}
                onClick={() => !fbOpen && toggleBus(time)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", letterSpacing: "-0.02em" }}>{time}</span>
                      {isNext && <span className="pill next pulse">prossima</span>}
                      {double && <span className="pill double">🚌🚌 doppio</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#444" }}>
                      {minsLeft <= 0 ? "⚡ in partenza" : `tra ${minsLeft} min`} · {count}/{cap} persone
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, color: occ.color }}>{count}</div>
                    <div style={{ fontSize: 18 }}>{occ.dot}</div>
                    <div style={{ fontSize: 10, color: occ.color, letterSpacing: ".05em", textTransform: "uppercase" }}>{occ.label}</div>
                  </div>
                </div>
                <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%`, background: occ.color }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {mine
                      ? <><span className="pill mine-p">✓ ci sono</span><button className="btn btn-leave" onClick={() => toggleBus(time)}>Esci</button></>
                      : <button className="btn btn-join" onClick={() => toggleBus(time)}>Prendo questo</button>}
                  </div>
                  <button className="btn btn-fb" onClick={e => { e.stopPropagation(); setFeedbackOpen(fbOpen ? null : key); }}>
                    {totalFb > 0 ? `${totalFb} feedback` : "Dai feedback"} ›
                  </button>
                </div>
                {fbOpen && (
                  <div className="fb-panel" onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Com'era il bus?</div>
                    {FEEDBACK_OPTIONS.map(opt => {
                      const votes = fbData[opt.id] || 0;
                      const selected = myFb === opt.id;
                      return (
                        <div key={opt.id} className={`fb-opt ${selected ? "selected" : ""}`} onClick={() => submitFeedback(time, opt.id)}>
                          <span style={{ fontSize: 16 }}>{opt.icon}</span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {votes > 0 && <span style={{ fontSize: 11, color: "#555", background: "#1a1a2a", padding: "2px 8px", borderRadius: 50 }}>{votes}</span>}
                          {selected && <span style={{ fontSize: 12, color: "#a89fff" }}>✓</span>}
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
          <div className="section-label">Corse passate</div>
          {past.slice(-4).map(({ time, double }) => {
            const key = cKey(time);
            const fkey = fKey(time);
            const fbData = feedbacks[fkey] || {};
            const totalFb = Object.values(fbData).reduce((a, b) => a + b, 0);
            return (
              <div key={key} className="card past" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>{time}</span>
                  {double && <span className="pill double" style={{ fontSize: 9 }}>🚌🚌</span>}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {totalFb > 0 && <span style={{ fontSize: 11, color: "#333" }}>{totalFb} fb</span>}
                  <span style={{ fontSize: 12, color: "#333" }}>{counts[key]?.count || 0} persone</span>
                </div>
              </div>
            );
          })}
        </>}

        <div style={{ marginTop: 32, fontSize: 10, color: "#1e1e2e", textAlign: "center", lineHeight: 2, letterSpacing: ".05em", textTransform: "uppercase" }}>
          Dati condivisi in tempo reale · Capacità 40 / 80 (doppio)
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}