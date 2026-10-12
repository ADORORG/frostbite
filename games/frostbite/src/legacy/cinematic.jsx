// FROST-BITE :: COLD OPEN — AAA cinematic boot, skippable, ends in operator select
(function () {
const { useState, useEffect, useRef, useCallback } = React;

// The cold-open transmission. Real Bitcoin history, delivered as the hook.
const COLD_OPEN = {
  tag: "COLD OPEN",
  from: "ORIGIN UNRESOLVED",
  lines: [
    "I buried a newspaper in the first block.",
    "Chancellor on brink of second bailout for banks.",
    "A timestamp nobody could forge. A reason nobody could delete.",
    "Seventeen years later you are standing in an arcade built in the seam I left open.",
    "Play carefully. The chain does not offer refunds.",
  ],
  sig: "S.N.",
};

const BOOT = [
  { t: 260, s: "alkanes runtime ......... ONLINE" },
  { t: 200, s: "subfrost bridge ......... SYNCED" },
  { t: 200, s: "frBTC reserve ........... VERIFIED" },
  { t: 190, s: "diesel rig .............. SPUN UP" },
  { t: 190, s: "mempool feed ............ LISTENING" },
  { t: 240, s: "house signer ............ ARMED" },
];

// ---------------- beats ----------------
// 0 studio glyph · 1 boot log · 2 title slam · 3 transmission · 4 operator select
function Cinematic({ onDone, onOperator, selected, AU }) {
  const [beat, setBeat] = useState(0);
  const [bootIx, setBootIx] = useState(0);
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState(false);
  const timers = useRef([]);
  const push = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBeat(4);
  }, []);

  // beat 0 → 1
  useEffect(() => {
    if (beat !== 0) return;
    AU && AU.play("open");
    push(() => setBeat(1), 1700);
  }, [beat]);

  // beat 1: boot log
  useEffect(() => {
    if (beat !== 1) return;
    if (bootIx >= BOOT.length) { push(() => setBeat(2), 420); return; }
    push(() => { setBootIx((i) => i + 1); AU && AU.play("click"); }, BOOT[bootIx].t);
  }, [beat, bootIx]);

  // beat 2: title slam
  useEffect(() => {
    if (beat !== 2) return;
    setFlash(true);
    AU && AU.play("jackpot");
    push(() => setFlash(false), 240);
    push(() => setBeat(3), 2600);
  }, [beat]);

  // beat 3: transmission types itself
  useEffect(() => {
    if (beat !== 3) return;
    if (line >= COLD_OPEN.lines.length) { push(() => setBeat(4), 1200); return; }
    const full = COLD_OPEN.lines[line];
    let i = 0;
    setTyped("");
    const iv = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(iv);
        push(() => setLine((l) => l + 1), line === COLD_OPEN.lines.length - 1 ? 1100 : 620);
      }
    }, 26);
    timers.current.push(() => clearInterval(iv));
    return () => clearInterval(iv);
  }, [beat, line]);

  // any key skips ahead
  useEffect(() => {
    function k(e) {
      if (beat >= 4) return;
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") { e.preventDefault(); skip(); }
    }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [beat, skip]);

  return (
    <div className="cine" data-beat={beat}>
      <div className="cine-grain"/>
      <div className="cine-bars"/>
      {flash && <div className="cine-flash"/>}

      {/* ---- beat 0: studio glyph ---- */}
      {beat === 0 && (
        <div className="cine-studio">
          <svg viewBox="0 0 120 120" className="cs-glyph">
            <g stroke="#5df6ff" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <path d="M60 14v92M14 60h92M27 27l66 66M93 27L27 93"/>
            </g>
            <circle cx="60" cy="60" r="9" fill="#ff2d9d"/>
          </svg>
          <div className="cs-tag">A BLOCK-PACED ARCADE</div>
        </div>
      )}

      {/* ---- beat 1: boot log ---- */}
      {beat === 1 && (
        <div className="cine-boot">
          {BOOT.slice(0, bootIx).map((b, i) => (
            <div key={i} className="cb-line">
              <span className="cb-ok">◆</span>{b.s}
            </div>
          ))}
          <div className="cb-caret"/>
        </div>
      )}

      {/* ---- beat 2: title slam ---- */}
      {beat === 2 && (
        <div className="cine-title">
          <div className="ct-ring"/>
          <div className="ct-word">FROST<span>·</span>BITE</div>
          <div className="ct-rule"/>
          <div className="ct-sub">a predictive minefield · on bitcoin · via alkanes</div>
        </div>
      )}

      {/* ---- beat 3: the transmission ---- */}
      {beat === 3 && (
        <div className="cine-tx">
          <div className="ctx-head">
            <span className="ctx-dot"/><span className="ctx-dot"/><span className="ctx-dot"/>
            <span className="ctx-from">▸ INCOMING TRANSMISSION · {COLD_OPEN.from}</span>
          </div>
          <div className="ctx-body">
            {COLD_OPEN.lines.slice(0, line).map((l, i) => (
              <p key={i} className="ctx-done">{l}</p>
            ))}
            {line < COLD_OPEN.lines.length && (
              <p className="ctx-live">{typed}<span className="ctx-caret"/></p>
            )}
          </div>
          {line >= COLD_OPEN.lines.length && <div className="ctx-sig">— {COLD_OPEN.sig}</div>}
        </div>
      )}

      {/* ---- beat 4: operator select ---- */}
      {beat === 4 && (
        <div className="cine-select">
          <div className="cselect-head">
            <div className="csh-kicker">▸ SELECT YOUR OPERATOR</div>
            <div className="csh-sub">
              Each one changes how the arcade treats you. You can swap any time from THE CREW.
            </div>
          </div>
          <div className="cselect-body">
            <CrewSelect selected={selected} onSelect={onOperator} onMine={() => {}}/>
          </div>
          <div className="cselect-foot">
            <button className="btn lg" onClick={() => { AU && AU.play("levelup"); onDone(); }}>
              ▸ ENTER THE ARCADE
            </button>
          </div>
        </div>
      )}

      {beat < 4 && (
        <button className="cine-skip" onClick={skip}>SKIP ▸</button>
      )}
      {beat < 4 && (
        <div className="cine-hint">press <b>SPACE</b> to skip</div>
      )}
    </div>
  );
}

Object.assign(window, { Cinematic, COLD_OPEN });
})();
