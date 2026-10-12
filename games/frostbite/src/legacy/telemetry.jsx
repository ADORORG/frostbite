// FROST-BITE :: telemetry — the internal loop. Every event, error and bug gets an ID.
(function () {
const { useState, useEffect, useRef } = React;

const STORE_KEY = "frostbite.telemetry.v1";
const MAX = 600;

// ---- ID minting: FB-XXXXX ----
function mintId(prefix) {
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  const r = Math.floor(Math.random() * 46656).toString(36).padStart(3, "0").toUpperCase();
  return `${prefix}-${t}${r}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { session: mintId("S"), started: Date.now(), entries: [] };
    const p = JSON.parse(raw);
    if (!p.session) p.session = mintId("S");
    if (!Array.isArray(p.entries)) p.entries = [];
    return p;
  } catch (e) {
    return { session: mintId("S"), started: Date.now(), entries: [] };
  }
}
function writeStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
}

const store = readStore();
// new session id each page load, but keep history
store.session = mintId("S");
store.started = Date.now();
writeStore(store);

const listeners = new Set();
function emit() { listeners.forEach((f) => f(store.entries)); }

let ctxProvider = () => ({});

function push(entry) {
  const e = {
    id: entry.id || mintId(entry.kind === "error" ? "ERR" : entry.kind === "bug" ? "BUG" : "EV"),
    ts: Date.now(),
    session: store.session,
    ...entry,
    ctx: { ...ctxProvider(), ...(entry.ctx || {}) },
  };
  store.entries.unshift(e);
  if (store.entries.length > MAX) store.entries.length = MAX;
  writeStore(store);
  emit();
  return e;
}

const FBLog = {
  setContext(fn) { ctxProvider = fn; },
  event(type, payload) { return push({ kind: "event", type, msg: type, ctx: payload }); },
  error(err, ctx, sev) {
    return push({
      kind: "error", type: (err && err.name) || "Error", sev: sev || "high",
      msg: (err && err.message) || String(err),
      stack: (err && err.stack) ? String(err.stack).split("\n").slice(0, 6).join("\n") : null,
      ctx,
    });
  },
  bug(msg, ctx, sev) { return push({ kind: "bug", type: "user-report", sev: sev || "medium", msg, ctx }); },
  all() { return store.entries; },
  session() { return store.session; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  clear() { store.entries = []; writeStore(store); emit(); },
  stats() {
    const s = { total: store.entries.length, events: 0, errors: 0, bugs: 0, byType: {} };
    for (const e of store.entries) {
      if (e.kind === "event") s.events++;
      else if (e.kind === "error") s.errors++;
      else if (e.kind === "bug") s.bugs++;
      s.byType[e.type] = (s.byType[e.type] || 0) + 1;
    }
    return s;
  },
};

// ---- global capture ----
const pending = [];
const popListeners = new Set();
function raise(entry) {
  pending.push(entry);
  popListeners.forEach((f) => f([...pending]));
}
function dismiss(id) {
  const i = pending.findIndex((p) => p.id === id);
  if (i >= 0) pending.splice(i, 1);
  popListeners.forEach((f) => f([...pending]));
}

window.addEventListener("error", (ev) => {
  if (ev.message && /ResizeObserver|Babel/i.test(ev.message)) return;
  const e = FBLog.error(ev.error || new Error(ev.message), { src: ev.filename, line: ev.lineno }, "high");
  raise(e);
});
window.addEventListener("unhandledrejection", (ev) => {
  const e = FBLog.error(ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason)), { kind: "promise" }, "high");
  raise(e);
});

// ---- React error boundary ----
class FBBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null, id: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    const e = FBLog.error(err, { componentStack: String(info.componentStack || "").split("\n").slice(0, 5).join("\n") }, "critical");
    raise(e);
    this.setState({ id: e.id });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="fb-crash">
          <div className="fb-crash-box">
            <div className="fd" style={{ fontSize: 13, color: "var(--hot)" }}>◆ CABINET FAULT ◆</div>
            <div className="ft" style={{ fontSize: 17, color: "var(--paper)", marginTop: 10, lineHeight: 1.4 }}>
              Something in this cabinet threw. It's been logged with an ID — the admin panel already has it.
            </div>
            <div className="fb-crash-id">{this.state.id}</div>
            <div className="ft dim" style={{ fontSize: 14, marginTop: 8 }}>{String(this.state.err.message).slice(0, 180)}</div>
            <div className="dock" style={{ marginTop: 18 }}>
              <button className="btn" onClick={() => this.setState({ err: null, id: null })}>▸ RETRY</button>
              <button className="btn ghost" onClick={() => location.reload()}>↻ RELOAD</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- auto-popup for caught faults ----
function FaultPopups() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    popListeners.add(setItems);
    setItems([...pending]);
    return () => popListeners.delete(setItems);
  }, []);
  if (!items.length) return null;
  return (
    <div className="fault-stack">
      {items.slice(0, 3).map((e) => (
        <div key={e.id} className={"fault-card sev-" + (e.sev || "medium")}>
          <div className="fault-head">
            <span className="fault-kind">{e.sev === "critical" ? "CRITICAL FAULT" : "FAULT LOGGED"}</span>
            <button className="fault-x" onClick={() => dismiss(e.id)}>✕</button>
          </div>
          <div className="fault-id" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(e.id); }}
               title="click to copy">{e.id}</div>
          <div className="fault-msg">{String(e.msg).slice(0, 160)}</div>
          <div className="fault-foot">
            <span>routed to admin panel</span>
            <a href="admin.html">open ▸</a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- player bug reporter ----
function BugReporter({ onClose, ctx }) {
  const [msg, setMsg] = useState("");
  const [sev, setSev] = useState("medium");
  const [filed, setFiled] = useState(null);
  if (filed) {
    return (
      <div className="bug-dock filed">
        <div className="bug-panel" style={{ textAlign: "center" }}>
          <div className="fd" style={{ fontSize: 12, color: "var(--mint)" }}>◆ REPORT FILED ◆</div>
          <div className="fb-crash-id" style={{ margin: "16px auto" }}>{filed}</div>
          <div className="ft dim" style={{ fontSize: 15, lineHeight: 1.5 }}>
            Quote this ID and the admin panel can pull your full session — every pick, every tx, every venue you touched.
          </div>
          <div className="dock" style={{ marginTop: 14 }}>
            <button className="btn block" onClick={onClose}>▸ BACK TO THE ICE</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bug-dock">
      <div className="bug-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <div className="fd frost" style={{ fontSize: 9 }}>▸ REPORT A BUG</div>
          <button className="btn sm ghost" onClick={onClose}>✕</button>
        </div>
        <div className="ft dim" style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
          Filed with an ID. Your session context attaches automatically — nothing is lost while this is open.
        </div>
        <div className="field-label">What happened?</div>
        <textarea className="input" rows="3" value={msg} autoFocus
                  style={{ resize: "vertical", fontFamily: "var(--f-mono)", fontSize: 13 }}
                  placeholder="the plinko board didn't reveal after the block…"
                  onChange={(e) => setMsg(e.target.value)}/>
        <div className="field-label" style={{ marginTop: 10 }}>Severity</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["low", "medium", "high", "critical"].map((s) => (
            <button key={s} className={"btn sm" + (sev === s ? "" : " ghost")} style={{ flex: 1 }}
                    onClick={() => setSev(s)}>{s}</button>
          ))}
        </div>
        <div className="sign-box" style={{ marginTop: 10, maxHeight: 86 }}>
          <div><span className="c">// auto-attached context</span></div>
          {Object.entries(ctx || {}).map(([k, v]) => (
            <div key={k}><span className="k">{k}</span>: <span className="v">{String(v)}</span></div>
          ))}
        </div>
        <div className="dock" style={{ marginTop: 12 }}>
          <button className="btn sm ghost" onClick={onClose}>cancel</button>
          <button className="btn" style={{ flex: 1 }} disabled={!msg.trim()}
                  onClick={() => { const e = FBLog.bug(msg.trim(), ctx, sev); setFiled(e.id); }}>
            ▸ FILE REPORT
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FBLog, FBBoundary, FaultPopups, BugReporter, mintId });
})();
