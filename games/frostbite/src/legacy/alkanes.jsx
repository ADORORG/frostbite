// FROST-BITE :: chain surface (simulation only)
//
// MIGRATION NOTE (platform, 2026-10-12): the original file also had a LIVE backend (an alkanesjs provider, RPC
// endpoints and a `fetch("/api/run")` call to a house signer). A game on the platform is client-only and runs in
// a frame with no network, so the live backend was removed by the owner's decision. The game stays the
// simulated, play-for-fun game it was; real chain actions come later through the platform (minting), never from
// the game. The surface the game uses is unchanged: FrostbiteChain, useChain, ChainStatus, verifyReveal.
(function () {
const { useState, useEffect, useRef, useCallback } = React;

// DIESEL is 2:0. The other two are not deployed, and the game must not claim otherwise.
const IDS = { DIESEL: "2:0", ICICLE: null, GLACIER: null };

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const dig = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// The client's half of commit/reveal: it verifies a reveal it was given. It cannot make a trustworthy
// commitment, and does not pretend to (the Fortress INV-06 says so).
async function verifyReveal({ commitment, layout, nonce, height }) {
  const recomputed = await sha256Hex(JSON.stringify(layout) + "|" + nonce + "|" + height);
  return { ok: recomputed === commitment, recomputed, commitment };
}

class FrostbiteChain {
  constructor(opts = {}) {
    this.mode = "sim";
    this.listeners = new Set();
    this._height = opts.startHeight || 871234;
    this._simTimer = null;
  }

  connect() {
    const h = Math.random().toString(36).slice(2, 6);
    this._startSimClock();
    return Promise.resolve({
      address: "bc1p" + "frost" + h + "…simulated",
      assetAddress: "bc1p" + "alk" + h + "…simulated",
      external: false,
      simulated: true,
    });
  }

  async balances() { return { diesel: 0n, glacier: 0n, simulated: true }; }
  async height() { return this._height; }
  onBlock(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(h) { this.listeners.forEach((f) => { try { f(h); } catch (e) {} }); }
  _startSimClock(sec = 20) {
    clearInterval(this._simTimer);
    this._simTimer = setInterval(() => { this._height++; this._emit(this._height); }, sec * 1000);
  }
  setSimBlockSeconds(sec) { this._startSimClock(sec); }
  stop() { clearInterval(this._simTimer); }

  async broadcastRun() {
    return { txid: "sim" + Math.random().toString(16).slice(2, 10), simulated: true, feePaidBy: "house" };
  }
  async cashOut({ icicles }) {
    return { ok: true, simulated: true, glacier: Math.round(icicles * 0.85), houseCut: 0.15 };
  }
  async wrapToFrBtc({ sats }) { return { ok: true, simulated: true, frbtc: sats }; }
  decodeTraces() { return []; }
}

function useChain(opts) {
  const ref = useRef(null);
  if (!ref.current) ref.current = new FrostbiteChain(opts);
  const [mode, setMode] = useState(ref.current.mode);
  const [height, setHeight] = useState(ref.current._height);

  useEffect(() => {
    const chain = ref.current;
    const off = chain.onBlock((h) => setHeight(h));
    return () => { off(); chain.stop(); };
  }, []);

  const connect = useCallback(async (kind) => {
    const r = await ref.current.connect(kind);
    setMode(ref.current.mode);
    return r;
  }, []);

  return { chain: ref.current, mode, height, connect, live: false };
}

function ChainStatus({ chain, mode }) {
  return (
    <div className="panel">
      <div className="panel-head tight">
        <span>▸ chain backend</span>
        <span style={{ color: "var(--gold)" }}>SIMULATED</span>
      </div>
      <div className="panel-body" style={{ padding: "9px 11px" }}>
        <div className="kv"><span className="k">sdk</span><span className="v">not loaded</span></div>
        <div className="kv"><span className="k">diesel</span><span className="v gold" style={{ color: "var(--gold)" }}>{IDS.DIESEL}</span></div>
        <div className="kv"><span className="k">glacier</span><span className="v" style={{ color: "var(--grey)" }}>not deployed</span></div>
        <div className="kv"><span className="k">signer</span><span className="v">simulated</span></div>
        <div className="ft dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          Every number here is generated locally. Nothing has touched Bitcoin.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FrostbiteChain, useChain, ChainStatus, ALKANE_IDS: IDS, verifyReveal, sha256Hex });
})();
