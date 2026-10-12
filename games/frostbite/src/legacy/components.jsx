// FROST-BITE :: components
// React 18 (global). Loaded after react + babel.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ----- tiny utility -----
const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
};
const fmtUsd = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const fmtBtc = (n) => n.toFixed(8) + " BTC";
const fmtTok = (n) => (Math.round(n * 100) / 100).toFixed(2);

// ----- SVG icons -----
const IcBitcoin = ({ size = 18 }) => (
  <svg className="ic bitcoin" viewBox="0 0 24 24" style={{ width: size, height: size }} fill="currentColor">
    <path d="M14.3 11.2c.9-.5 1.5-1.4 1.4-2.7-.2-1.7-1.6-2.4-3.5-2.5l-.1-2.5h-1.6l.1 2.4h-1.3l-.1-2.4H7.6l.1 2.5H4.5v1.6h1.1c.6 0 .9.3.9.8l.4 7.6c0 .4-.3.7-.7.7H5l-.3 1.8h3l.1 2.5h1.6l-.1-2.4h1.3l.1 2.4h1.6l-.1-2.5c2.4-.2 4.1-1.1 4-3.4-.1-1.7-1.2-2.4-2.9-2.6zM9.7 7.7c1 0 3.4-.3 3.5 1.1.1 1.4-2.4 1.2-3.4 1.2l-.1-2.3zm.4 7.7l-.1-2.6c1.2 0 4-.3 4.1 1.2.1 1.6-2.7 1.4-4 1.4z"/>
  </svg>
);
const IcSnow = ({ size = 24, color = "currentColor" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round">
    <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/>
    <path d="M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2M5 12l-2 2M5 12l-2-2M19 12l2 2M19 12l2-2"/>
  </svg>
);
const IcFuel = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16"/>
    <path d="M5 21h10"/>
    <path d="M15 8h2a2 2 0 012 2v6a1.5 1.5 0 003 0V7l-2-2"/>
    <path d="M7 7h6v4H7z" fill="currentColor" opacity="0.3"/>
  </svg>
);
const IcLock = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="1"/>
    <path d="M8 11V7a4 4 0 018 0v4"/>
  </svg>
);

// ----- Snowfall background -----
function Snowfall() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    let raf, w, h;
    const flakes = [];
    function resize() {
      w = c.width = window.innerWidth * devicePixelRatio;
      h = c.height = window.innerHeight * devicePixelRatio;
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 90; i++) {
      flakes.push({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 2.4,
        vx: -0.2 + Math.random() * 0.4,
        vy: 0.3 + Math.random() * 1.1,
        a: 0.3 + Math.random() * 0.6
      });
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.x += f.vx; f.y += f.vy;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x < -4) f.x = w + 4;
        if (f.x > w + 4) f.x = -4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(180, 235, 255, ${f.a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(93,246,255,0.6)";
        ctx.arc(f.x, f.y, f.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="snow" />;
}

// ----- HUD -----
function Hud({ user, balance, fuel, dxbtc, height, onWallet, onSettings }) {
  return (
    <div className="hud">
      <div className="brand">
        <div className="logo">
          <IcSnow size={22} color="#5df6ff" />
        </div>
        <div>
          <div className="name">FROST&middot;BITE</div>
          <div className="sub">block-paced minefield · alkanes</div>
        </div>
      </div>
      <div className="hud-stats">
        <div className="stat">
          <div className="label">Block #</div>
          <div className="val gold">{height.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">Vault (BTC)</div>
          <div className="val">${balance.usd.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Icicles</div>
          <div className="val">{Math.round(fuel).toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">Glacier</div>
          <div className="val gold">{dxbtc.toFixed(3)}</div>
        </div>
        <div className="stat">
          <div className="label">player</div>
          <div className="val" style={{ fontSize: 16 }}>{user || "guest"}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a className="btn sm ghost" href="admin.html"
           style={{ textDecoration: "none" }} title="admin console">⌷ ADMIN</a>
        <button className="btn sm gold" onClick={onWallet}>Wallet</button>
        <button className="btn sm ghost" onClick={onSettings}>⚙</button>
      </div>
    </div>
  );
}

// ----- Marquee headline -----
function Marquee({ height }) {
  const items = [
    <>frost-bite v0.3 · we pay every <span className="gold">sat</span> of gas — the house signs, the house mines, <span className="mag">you keep 85%</span></>,
    <>predict <span>4</span> blocks ahead · current block <span className="gold">{height.toLocaleString()}</span></>,
    <><span>9</span> cabinets · <span className="mag">king of the sat</span> · subzero core · minercraft</>,
    <>every transaction mines <span className="gold">diesel</span> · icicles → <span>GLACIER</span> on cashout</>,
    <>powered by <span>subfrost</span> · alkanes envelope · human 69 · agent 42 · <span className="gold">$dog 21</span></>,
  ];
  return (
    <div className="marquee">
      <div className="marquee-track">
        {items.map((it, i) => <React.Fragment key={i}>◆ {it} &nbsp;&nbsp;&nbsp;&nbsp;</React.Fragment>)}
        {items.map((it, i) => <React.Fragment key={"b" + i}>◆ {it} &nbsp;&nbsp;&nbsp;&nbsp;</React.Fragment>)}
      </div>
    </div>
  );
}

// ----- Block clock -----
function BlockClock({ height, progress, etaSec, mempoolSat, fastSim }) {
  return (
    <div className="panel">
      <div className="block-clock">
        <div className="block-num">BLK ▸ #{(height + 1).toLocaleString()}</div>
        <div>
          <div className="block-bar">
            <div className="fill" style={{ width: (progress * 100).toFixed(2) + "%" }} />
            <div className="ticks" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--f-term)", fontSize: 13, color: "var(--silver)" }}>
            <span>defrost in <b className="frost">{etaSec > 60 ? Math.floor(etaSec / 60) + "m " + Math.floor(etaSec % 60) + "s" : Math.floor(etaSec) + "s"}</b></span>
            <span className="dim">{fastSim ? "SIM ×120" : "live · ~10min target"}</span>
          </div>
        </div>
        <div className="mempool">
          <span className="dot" />
          <div>
            <div style={{ fontSize: 11, color: "var(--silver)", textTransform: "uppercase", letterSpacing: "0.1em" }}>mempool</div>
            <div className="frost">{mempoolSat} sat/vB · 14.2k tx</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- ArcadeStrip: 9 cabinets shown below boards -----
function ArcadeStrip({ session, currentIx, onSwap }) {
  return (
    <div className="panel arcade-strip">
      <div className="panel-head">
        <span>▸ the arcade · 9 cabinets</span>
        <span className="ft dim" style={{ fontFamily: "var(--f-term)", fontSize: 14, letterSpacing: "0.04em", textTransform: "none" }}>
          click a cabinet to load it into the next free board
        </span>
      </div>
      <div className="arcade-grid">
        {(window.GAME9_KEYS || []).map((k) => {
          const g = (window.GAMES9 || {})[k];
          if (!g) return null;
          const inUseAt = session
            .map((b, i) => ({ b, i }))
            .filter(({ b, i }) => b.gameKey === k && !b.revealed && i >= currentIx);
          return (
            <div key={k} className="cab"
                 style={{ "--cab-accent": g.color }}
                 onClick={() => onSwap(k)}>
              {inUseAt.slice(0,1).map(({ i }) => <span key={i} className="cab-slot" style={{ background: g.color }}>B{i+1}</span>)}
              <div className="cab-icon"><g.Icon/></div>
              <div className="cab-name">{g.name}</div>
              <div className="cab-blurb">{g.blurb}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- GamePicker modal -----
function GamePicker({ boardIx, onPick, onClose }) {
  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="fd frost" style={{ fontSize: 12 }}>▸ SWAP CABINET · BOARD {String(boardIx + 1).padStart(2, "0")}</div>
            <div className="ft dim" style={{ fontSize: 15, marginTop: 4 }}>nine cabinets, nine different games</div>
          </div>
          <button className="btn sm ghost" onClick={onClose}>✕</button>
        </div>
        <div className="picker-grid">
          {(window.GAME9_KEYS || []).map((k) => {
            const g = (window.GAMES9 || {})[k];
            if (!g) return null;
            return (
              <div key={k} className="cab" style={{ "--cab-accent": g.color }} onClick={() => onPick(k)}>
                <div className="cab-icon"><g.Icon/></div>
                <div className="cab-name">{g.name}</div>
                <div className="cab-blurb">{g.blurb}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----- Tile (legacy — kept for backward compat) -----
function Tile({ idx, picked, revealed, isMine, adjacent, tier, onClick, isAnimating }) {
  let cls = "tile";
  if (tier === "dead" || tier === "4") cls += " locked";
  if (picked && !revealed) cls += " picked";
  if (revealed) {
    if (isMine && picked) cls += " mine";
    else if (picked && !isMine) cls += " safe";
    else cls += " thaw"; // unselected tile defrosts to neutral
  } else {
    cls += " frozen";
  }
  return (
    <div className={cls} data-n={adjacent || ""} onClick={onClick}>
      <div className="veil" />
    </div>
  );
}

// ----- Board (hosts any of the 9 live cabinets) -----
function Board({ board, ix, tier, locked, gated, gateOn, onScore, onBust, onRunDone, onSwap }) {
  const G9 = window.GAMES9 || {};
  const game = G9[board.gameKey] || G9.sats;
  if (!game) return null;
  const Play = game.Play;
  const run = board.run || { score: 0, busted: false, done: false, started: false };
  const flashCls = board.flash === "win" ? " win-flash" : board.flash === "bust" ? " bust-flash" : "";
  const status = board.status;
  // gated boards are visible but not playable — you clear the live block first
  const live = !locked && !gated && !board.revealed && tier !== "dead";
  return (
    <div className={"board" + flashCls + (gated ? " gated" : "")} data-tier={tier} data-cab={game.key}
         style={{ "--cab-accent": game.color }}>
      <button className="swap-btn" onClick={(e) => { e.stopPropagation(); onSwap && onSwap(ix); }} title="swap cabinet">↻</button>
      <div className="board-head">
        <div className="ix">
          <span className="game-tag" style={{ color: game.color, borderColor: "currentColor" }}>{game.short}</span>
          &nbsp;BOARD <b>{String(ix + 1).padStart(2, "0")}</b> · BLK +{ix + 1}
        </div>
        {tier === "now"  && status === "pending" && <span className="tag now">▶ PLAYING NOW</span>}
        {tier === "next" && status === "pending" && <span className="tag next">NEXT</span>}
        {tier === "3"    && status === "pending" && <span className="tag queue">T-3</span>}
        {tier === "4"    && status === "pending" && <span className="tag queue">T-4</span>}
        {status === "won"  && <span className="tag won">✓ +{board.icicles}</span>}
        {status === "bust" && <span className="tag bust">✗ BUSTED</span>}
        {status === "skip" && <span className="tag skip">NOT PLAYED</span>}
      </div>
      <div className="play-surface">
        <Play state={board.state} run={run} live={live} revealed={board.revealed}
              onScore={onScore} onBust={onBust} onDone={onRunDone}/>
        {gated && !board.revealed && (
          <div className="gate-veil">
            <span className="gv-lock">▩</span>
            <span className="gv-t">LOCKED</span>
            <span className="gv-s">clear board {String(gateOn + 1).padStart(2, "0")} first</span>
          </div>
        )}
      </div>
      <div className="board-foot">
        <div className="picks-dim">{game.name.toLowerCase()}</div>
        <div className={"mult " + (run.score === 0 ? "zero" : status === "won" ? "win" : "")}>
          ×{(run.score * 0.55 * (run.done ? 1.5 : 1)).toFixed(2)}
        </div>
      </div>
      {live && !run.started && (
        <div className="pick-hint">▸ <b>play it live</b> — the block confirms your score into icicles</div>
      )}
    </div>
  );
}

// payout multiplier for safe-tile count
function multiplierFor(n) {
  if (n <= 0) return 1.0;
  // 5 mines / 25 → each safe pick ~×1.20 with small bonus
  let m = 1;
  for (let i = 0; i < n; i++) m *= 1.22;
  return m;
}

// ----- Mascot polar bear (pixel SVG) -----
function Mascot({ mood }) {
  // mood: idle | cheer | sad
  return (
    <div className={"mascot bob " + (mood === "cheer" ? "cheer" : mood === "sad" ? "sad" : "")}>
      <svg viewBox="0 0 32 32" width="96" height="96" shapeRendering="crispEdges">
        {/* ear shadows */}
        <rect x="6" y="5" width="3" height="3" fill="#dfeaf6"/>
        <rect x="23" y="5" width="3" height="3" fill="#dfeaf6"/>
        {/* outline */}
        <rect x="7" y="6" width="1" height="2" fill="#0b1226"/>
        <rect x="24" y="6" width="1" height="2" fill="#0b1226"/>
        {/* head */}
        <rect x="8" y="7" width="16" height="14" fill="#ffffff"/>
        <rect x="7" y="8" width="1" height="12" fill="#0b1226"/>
        <rect x="24" y="8" width="1" height="12" fill="#0b1226"/>
        <rect x="8" y="6" width="16" height="1" fill="#0b1226"/>
        <rect x="8" y="21" width="16" height="1" fill="#0b1226"/>
        {/* ears inside */}
        <rect x="7" y="6" width="2" height="2" fill="#0b1226"/>
        <rect x="23" y="6" width="2" height="2" fill="#0b1226"/>
        <rect x="7" y="6" width="1" height="1" fill="#ff8fc7"/>
        <rect x="24" y="6" width="1" height="1" fill="#ff8fc7"/>
        {/* eyes */}
        {mood !== "sad" ? (
          <>
            <rect x="11" y="11" width="2" height="2" fill="#0b1226"/>
            <rect x="19" y="11" width="2" height="2" fill="#0b1226"/>
            <rect x="12" y="11" width="1" height="1" fill="#5df6ff"/>
            <rect x="20" y="11" width="1" height="1" fill="#5df6ff"/>
          </>
        ) : (
          <>
            <rect x="11" y="12" width="2" height="1" fill="#0b1226"/>
            <rect x="19" y="12" width="2" height="1" fill="#0b1226"/>
          </>
        )}
        {/* nose */}
        <rect x="15" y="15" width="2" height="2" fill="#0b1226"/>
        {/* mouth */}
        {mood === "cheer" ? (
          <>
            <rect x="13" y="18" width="6" height="1" fill="#0b1226"/>
            <rect x="12" y="17" width="1" height="1" fill="#0b1226"/>
            <rect x="19" y="17" width="1" height="1" fill="#0b1226"/>
          </>
        ) : mood === "sad" ? (
          <>
            <rect x="13" y="19" width="6" height="1" fill="#0b1226"/>
            <rect x="12" y="20" width="1" height="1" fill="#0b1226"/>
            <rect x="19" y="20" width="1" height="1" fill="#0b1226"/>
          </>
        ) : (
          <rect x="13" y="18" width="6" height="1" fill="#0b1226"/>
        )}
        {/* scarf */}
        <rect x="6" y="22" width="20" height="2" fill="#ff2d9d"/>
        <rect x="6" y="24" width="20" height="1" fill="#c91c7a"/>
        <rect x="24" y="24" width="4" height="3" fill="#ff2d9d"/>
        <rect x="24" y="27" width="1" height="1" fill="#ff2d9d"/>
        <rect x="26" y="27" width="1" height="1" fill="#ff2d9d"/>
      </svg>
    </div>
  );
}

function Bubble({ text, show }) {
  return <div className={"bubble " + (show ? "show" : "")}>{text}</div>;
}

// ----- Tweaks Panel content (lives inside imported TweaksPanel) -----
function FrostbiteTweaks({ tweaks, setTweak }) {
  return (
    <>
      <TweakSection label="Game" />
      <TweakSelect
        label="Block speed"
        value={String(tweaks.blockSec)}
        onChange={(v) => setTweak("blockSec", Number(v))}
        options={[
          { value: "5",   label: "Fast sim · 5s" },
          { value: "20",  label: "Demo · 20s" },
          { value: "60",  label: "Slow · 1 min" },
          { value: "600", label: "Realistic · 10 min" },
        ]}
      />
      <TweakSlider
        label="Mines per board"
        min={2} max={10} step={1}
        value={tweaks.mines}
        onChange={(v) => setTweak("mines", v)}
      />
      <TweakSlider
        label="House cut" unit="%"
        min={0} max={30} step={1}
        value={tweaks.houseCut}
        onChange={(v) => setTweak("houseCut", v)}
      />
      <TweakSection label="Look" />
      <TweakToggle label="Unlock all venues" value={tweaks.unlockAll} onChange={(v) => setTweak("unlockAll", v)} />
      <TweakToggle label="Demo: short sessions" value={tweaks.shortSessions} onChange={(v) => setTweak("shortSessions", v)} />
      <TweakSlider
        label="CRT intensity"
        min={0} max={1} step={0.05}
        value={tweaks.crt}
        onChange={(v) => setTweak("crt", v)}
      />
      <TweakToggle
        label="Snowfall"
        value={tweaks.snow}
        onChange={(v) => setTweak("snow", v)}
      />
      <TweakToggle
        label="Mascot"
        value={tweaks.mascot}
        onChange={(v) => setTweak("mascot", v)}
      />
      <TweakSection label="Demo" />
      <TweakButton label="↻ Reset session" onClick={() => window.__frostbite_reset?.()} />
      <TweakButton label="▸ Force next block" onClick={() => window.__frostbite_advance?.()} secondary />
    </>
  );
}

// expose
Object.assign(window, {
  Snowfall, Hud, Marquee, BlockClock, Tile, Board, Mascot, Bubble,
  ArcadeStrip, GamePicker,
  FrostbiteTweaks, multiplierFor,
  IcBitcoin, IcSnow, IcFuel, IcLock,
  fmtUsd, fmtBtc, fmtTok, rng,
});
