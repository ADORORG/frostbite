// FROST-BITE :: minigames
// 9 cabinets — all share "pick safe, avoid mines" core mechanic
// but each renders a unique visual / interaction.
// Scoped in IIFE to avoid hook-name collisions across babel scripts.
(function () {
  const { useState, useEffect, useRef, useMemo } = React;

  // ---------- shared helpers ----------
  function mgRng(seed) {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  }
  function pickN(seed, total, n) {
    const r = mgRng(seed);
    const set = new Set();
    while (set.size < Math.min(n, total)) set.add(Math.floor(r() * total));
    return [...set];
  }
  function shuffle(seed, arr) {
    const r = mgRng(seed);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ===========================================================
  // 1. MINEFIELD  ── 5×5 frost tiles
  // ===========================================================
  function MinefieldView({
    state,
    picks,
    onPick,
    revealed,
    locked,
    scale = 1,
  }) {
    const mines = state.mines;
    function adj(i) {
      let n = 0;
      const x = i % 5,
        y = Math.floor(i / 5);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx > 4 || ny > 4) continue;
          if (mines.includes(ny * 5 + nx)) n++;
        }
      return n;
    }
    return (
      <div className="mg-grid mg-grid-5" data-scale={scale}>
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = mines.includes(i);
          const isPicked = picks.includes(i);
          let cls = "mg-cell mf";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              {revealed && isPicked && isMine && (
                <span className="ic-mine">✱</span>
              )}
              {revealed && isPicked && !isMine && (
                <span className="ic-num">{adj(i)}</span>
              )}
              {isPicked && !revealed && <span className="ic-pick">◆</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 2. BLOCK INVADERS ── 6×4 alien grid (24 cells)
  // ===========================================================
  function InvaderSprite({ kind, dead, glow }) {
    // 4 kinds: 0=squid, 1=crab, 2=octo, 3=elite
    const palettes = [
      { body: "#5df6ff", eye: "#0b1226" },
      { body: "#6fffb0", eye: "#0b1226" },
      { body: "#ffd24a", eye: "#0b1226" },
      { body: "#ff2d9d", eye: "#fff" },
    ];
    const p = palettes[kind];
    if (dead)
      return (
        <svg
          viewBox="0 0 16 16"
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        >
          <g fill="#ff6b35" opacity="0.85">
            <rect x="4" y="4" width="2" height="2" />
            <rect x="10" y="4" width="2" height="2" />
            <rect x="4" y="10" width="2" height="2" />
            <rect x="10" y="10" width="2" height="2" />
            <rect x="7" y="7" width="2" height="2" />
          </g>
        </svg>
      );
    // squid
    if (kind === 0)
      return (
        <svg
          viewBox="0 0 16 16"
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        >
          <g
            fill={p.body}
            style={{
              filter: glow ? "drop-shadow(0 0 4px " + p.body + ")" : "",
            }}
          >
            <rect x="7" y="2" width="2" height="2" />
            <rect x="5" y="4" width="6" height="2" />
            <rect x="3" y="6" width="10" height="4" />
            <rect x="5" y="10" width="2" height="2" />
            <rect x="9" y="10" width="2" height="2" />
            <rect x="3" y="12" width="2" height="2" />
            <rect x="11" y="12" width="2" height="2" />
          </g>
          <rect x="6" y="7" width="1" height="2" fill={p.eye} />
          <rect x="9" y="7" width="1" height="2" fill={p.eye} />
        </svg>
      );
    // crab
    if (kind === 1)
      return (
        <svg
          viewBox="0 0 16 16"
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        >
          <g
            fill={p.body}
            style={{
              filter: glow ? "drop-shadow(0 0 4px " + p.body + ")" : "",
            }}
          >
            <rect x="3" y="3" width="2" height="2" />
            <rect x="11" y="3" width="2" height="2" />
            <rect x="4" y="5" width="8" height="2" />
            <rect x="2" y="7" width="12" height="2" />
            <rect x="2" y="9" width="2" height="3" />
            <rect x="12" y="9" width="2" height="3" />
            <rect x="5" y="9" width="2" height="2" />
            <rect x="9" y="9" width="2" height="2" />
          </g>
          <rect x="5" y="7" width="1" height="1" fill={p.eye} />
          <rect x="10" y="7" width="1" height="1" fill={p.eye} />
        </svg>
      );
    // octo
    if (kind === 2)
      return (
        <svg
          viewBox="0 0 16 16"
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        >
          <g
            fill={p.body}
            style={{
              filter: glow ? "drop-shadow(0 0 4px " + p.body + ")" : "",
            }}
          >
            <rect x="5" y="3" width="6" height="2" />
            <rect x="3" y="5" width="10" height="4" />
            <rect x="2" y="7" width="2" height="2" />
            <rect x="12" y="7" width="2" height="2" />
            <rect x="3" y="9" width="2" height="2" />
            <rect x="11" y="9" width="2" height="2" />
            <rect x="5" y="9" width="2" height="2" />
            <rect x="9" y="9" width="2" height="2" />
          </g>
          <rect x="6" y="6" width="1" height="1" fill={p.eye} />
          <rect x="9" y="6" width="1" height="1" fill={p.eye} />
        </svg>
      );
    // elite (mine!)
    return (
      <svg
        viewBox="0 0 16 16"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
      >
        <g
          fill={p.body}
          style={{ filter: "drop-shadow(0 0 5px " + p.body + ")" }}
        >
          <rect x="6" y="2" width="4" height="1" />
          <rect x="4" y="3" width="8" height="2" />
          <rect x="3" y="5" width="10" height="5" />
          <rect x="2" y="6" width="1" height="3" />
          <rect x="13" y="6" width="1" height="3" />
          <rect x="5" y="10" width="2" height="2" />
          <rect x="9" y="10" width="2" height="2" />
        </g>
        <rect x="5" y="6" width="2" height="2" fill={p.eye} />
        <rect x="9" y="6" width="2" height="2" fill={p.eye} />
      </svg>
    );
  }
  function InvadersView({ state, picks, onPick, revealed, locked }) {
    // 24 cells in 6x4. mines = elite (kind=3); others = squid/crab/octo by row
    const kinds = state.kinds; // length 24, 0-3
    return (
      <div className="mg-invaders" style={{ "--cols": 6 }}>
        {Array.from({ length: 24 }, (_, i) => {
          const isMine = state.mines.includes(i);
          const isPicked = picks.includes(i);
          const k = isMine ? 3 : kinds[i];
          let cls = "mg-inv-cell";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              <div className="inv-sprite">
                <InvaderSprite
                  kind={k}
                  dead={revealed && isPicked && isMine}
                  glow={isPicked && !revealed && isMine}
                />
              </div>
              {isPicked && !revealed && <div className="laser" />}
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 3. FROST CRUSH ── 5×5 gem grid; mines = bomb gems
  // ===========================================================
  const GEM_COLORS = ["#5df6ff", "#ff2d9d", "#6fffb0", "#ffd24a", "#a280ff"];
  function GemShape({ color, bomb, dead }) {
    if (dead)
      return (
        <svg viewBox="0 0 20 20" width="100%" height="100%">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="#0b1226"
            stroke="#ff6b35"
            strokeWidth="1.5"
          />
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fontFamily="VT323"
            fontSize="14"
            fill="#ff6b35"
          >
            X
          </text>
        </svg>
      );
    if (bomb)
      return (
        <svg
          viewBox="0 0 20 20"
          width="100%"
          height="100%"
          style={{ filter: "drop-shadow(0 0 5px #ff2d9d)" }}
        >
          <circle
            cx="10"
            cy="11"
            r="6.5"
            fill="#1a0a26"
            stroke="#ff2d9d"
            strokeWidth="1.5"
          />
          <path d="M10 3 L11 6 L10 5 L9 6 Z" fill="#ffd24a" />
          <circle cx="10" cy="3.5" r="1" fill="#ff6b35" />
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fontFamily="VT323"
            fontSize="11"
            fill="#ff2d9d"
          >
            ✸
          </text>
        </svg>
      );
    return (
      <svg
        viewBox="0 0 20 20"
        width="100%"
        height="100%"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      >
        <polygon
          points="10,2 17,7 14,17 6,17 3,7"
          fill={color}
          stroke="#0b1226"
          strokeWidth="0.6"
        />
        <polygon points="10,2 14,7 10,9 6,7" fill="white" opacity="0.35" />
        <polygon points="10,9 14,7 14,17 10,15" fill="black" opacity="0.18" />
      </svg>
    );
  }
  function CrushView({ state, picks, onPick, revealed, locked }) {
    const colors = state.colors; // 25 indices 0-4
    return (
      <div className="mg-grid mg-grid-5 crush">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = state.mines.includes(i);
          const isPicked = picks.includes(i);
          let cls = "mg-cell crush-cell";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              <div className="gem">
                <GemShape
                  color={GEM_COLORS[colors[i]]}
                  bomb={revealed && isMine}
                  dead={revealed && isPicked && isMine}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 4. ICE-TRIS ── 5-col well with stacked blocks; mines = "garbage"
  // ===========================================================
  function IcetrisView({ state, picks, onPick, revealed, locked }) {
    // 25 cells in 5x5; visualize as tetrominoes
    const tetros = state.tetros; // length 25, color index 0-3
    const TC = ["#5df6ff", "#ff2d9d", "#6fffb0", "#ffd24a"];
    return (
      <div className="mg-grid mg-grid-5 tetra">
        {Array.from({ length: 25 }, (_, i) => {
          const isMine = state.mines.includes(i);
          const isPicked = picks.includes(i);
          let cls = "mg-cell tetra-cell";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          const c = isMine ? "#3a4565" : TC[tetros[i]];
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              <div
                className="tblk"
                style={{
                  background: c,
                  boxShadow: isMine
                    ? ""
                    : `inset 0 -3px 0 rgba(0,0,0,0.35), inset 2px 2px 0 rgba(255,255,255,0.35)`,
                }}
              >
                {revealed && isMine && <span className="garbage">✕</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 5. PLINKO ── 7 slots, pegs above
  // ===========================================================
  function PlinkoView({ state, picks, onPick, revealed, locked }) {
    // 7 slots, 2 are skull (mines)
    const mults = [3, 1.5, 1.2, 0.8, 1.2, 1.5, 3];
    const tints = [
      "rgba(255,45,157,.3)",
      "rgba(106,77,255,.24)",
      "rgba(93,246,255,.2)",
      "rgba(91,109,138,.18)",
      "rgba(93,246,255,.2)",
      "rgba(106,77,255,.24)",
      "rgba(255,45,157,.3)",
    ];
    return (
      <div className="mg-plinko">
        <div className="plinko-pegs">
          {!revealed && <span className="plinko-ball" />}
          {Array.from({ length: 6 }, (_, r) => (
            <div key={r} className="peg-row" style={{ "--n": r + 2 }}>
              {Array.from({ length: r + 2 }, (_, i) => (
                <span key={i} className="peg" />
              ))}
            </div>
          ))}
        </div>
        <div className="plinko-slots">
          {Array.from({ length: 7 }, (_, i) => {
            const isMine = state.mines.includes(i);
            const isPicked = picks.includes(i);
            let cls = "plinko-slot";
            if (isPicked && !revealed) cls += " picked";
            if (revealed) {
              cls += " thaw";
              if (isPicked && isMine) cls += " mine";
              else if (isPicked) cls += " safe";
            } else cls += " frozen";
            if (locked) cls += " locked";
            return (
              <div
                key={i}
                className={cls}
                style={{ "--pk": tints[i] }}
                data-hot={mults[i] >= 3 ? "1" : undefined}
                onClick={() => !locked && !revealed && onPick(i)}
              >
                <div className="mg-veil" />
                <div className="plinko-face">
                  {revealed && isMine ? "☠" : mults[i] + "×"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===========================================================
  // 6. CRYO WHEEL ── 12 wedges
  // ===========================================================
  function WheelView({ state, picks, onPick, revealed, locked }) {
    const cx = 100,
      cy = 100,
      r = 92,
      ir = 30;
    const wedgeColors = [
      "#5df6ff",
      "#ff2d9d",
      "#6fffb0",
      "#ffd24a",
      "#a280ff",
      "#5df6ff",
      "#ff2d9d",
      "#6fffb0",
      "#ffd24a",
      "#a280ff",
      "#5df6ff",
      "#ff2d9d",
    ];
    function arc(i) {
      const a1 = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + r * Math.cos(a1),
        y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2),
        y2 = cy + r * Math.sin(a2);
      const xi1 = cx + ir * Math.cos(a1),
        yi1 = cy + ir * Math.sin(a1);
      const xi2 = cx + ir * Math.cos(a2),
        yi2 = cy + ir * Math.sin(a2);
      return `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 0 0 ${xi1} ${yi1} Z`;
    }
    return (
      <div className="mg-wheel">
        <svg viewBox="0 0 200 200" width="100%" height="100%">
          <defs>
            <filter id="wheelGlow">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={r + 4}
            fill="none"
            stroke="#2a3c70"
            strokeWidth="2"
          />
          {Array.from({ length: 12 }, (_, i) => {
            const isMine = state.mines.includes(i);
            const isPicked = picks.includes(i);
            const fill =
              revealed && isMine && isPicked
                ? "#ff6b35"
                : revealed && isMine
                  ? "#1a0a14"
                  : isPicked && !revealed
                    ? wedgeColors[i]
                    : wedgeColors[i];
            const opacity =
              !isPicked && !revealed ? 0.35 : revealed && !isPicked ? 0.25 : 1;
            return (
              <g
                key={i}
                style={{ cursor: locked || revealed ? "default" : "pointer" }}
                onClick={() => !locked && !revealed && onPick(i)}
              >
                <path
                  d={arc(i)}
                  fill={fill}
                  opacity={opacity}
                  stroke="#0b1226"
                  strokeWidth="1"
                  style={{
                    filter:
                      isPicked && !revealed
                        ? `drop-shadow(0 0 4px ${wedgeColors[i]})`
                        : "",
                    transition: "opacity 0.3s",
                  }}
                />
                {isPicked && !revealed && (
                  <text
                    x={
                      cx +
                      (r - 18) *
                        Math.cos(((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2)
                    }
                    y={
                      cy +
                      (r - 18) *
                        Math.sin(((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2) +
                      4
                    }
                    textAnchor="middle"
                    fontFamily="VT323"
                    fontSize="14"
                    fill="#0b1226"
                  >
                    ◆
                  </text>
                )}
                {revealed && isMine && (
                  <text
                    x={
                      cx +
                      (r - 18) *
                        Math.cos(((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2)
                    }
                    y={
                      cy +
                      (r - 18) *
                        Math.sin(((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2) +
                      5
                    }
                    textAnchor="middle"
                    fontFamily="VT323"
                    fontSize="16"
                    fill="#ff6b35"
                  >
                    ☠
                  </text>
                )}
              </g>
            );
          })}
          <circle
            cx={cx}
            cy={cy}
            r={ir - 4}
            fill="#0b1226"
            stroke="#5df6ff"
            strokeWidth="1.5"
          />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontFamily="Press Start 2P"
            fontSize="9"
            fill="#5df6ff"
          >
            SPIN
          </text>
          {/* pointer */}
          <polygon
            points={`${cx - 6},6 ${cx + 6},6 ${cx},22`}
            fill="#ffd24a"
            stroke="#0b1226"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  }

  // ===========================================================
  // 7. HASH DICE ── 11 outcomes (sum 2..12)
  // ===========================================================
  function DiceFace({ n, color = "#5df6ff", dead }) {
    // n: 1..6
    const dots =
      {
        1: [[10, 10]],
        2: [
          [5, 5],
          [15, 15],
        ],
        3: [
          [5, 5],
          [10, 10],
          [15, 15],
        ],
        4: [
          [5, 5],
          [15, 5],
          [5, 15],
          [15, 15],
        ],
        5: [
          [5, 5],
          [15, 5],
          [10, 10],
          [5, 15],
          [15, 15],
        ],
        6: [
          [5, 5],
          [15, 5],
          [5, 10],
          [15, 10],
          [5, 15],
          [15, 15],
        ],
      }[n] || [];
    return (
      <svg viewBox="0 0 20 20" width="100%" height="100%">
        <rect
          x="1"
          y="1"
          width="18"
          height="18"
          rx="3"
          fill="#0b1226"
          stroke={dead ? "#ff6b35" : color}
          strokeWidth="1.2"
          style={{ filter: `drop-shadow(0 0 3px ${dead ? "#ff6b35" : color})` }}
        />
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d[0]}
            cy={d[1]}
            r="1.4"
            fill={dead ? "#ff6b35" : color}
          />
        ))}
      </svg>
    );
  }
  function DiceView({ state, picks, onPick, revealed, locked }) {
    // outcomes 2..12 = 11 cells. Display as pairs of d6 faces.
    // mines: state.mines is which indices are "snake" busts
    return (
      <div className="mg-dice">
        {Array.from({ length: 11 }, (_, i) => {
          const sum = i + 2;
          const isMine = state.mines.includes(i);
          const isPicked = picks.includes(i);
          let cls = "dice-cell";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          // pick a die pair that sums to `sum`
          const a = Math.max(1, Math.min(6, Math.floor(sum / 2)));
          const b = sum - a;
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              <div className="dice-pair">
                <DiceFace
                  n={a}
                  dead={revealed && isMine}
                  color={isPicked ? "#ff2d9d" : "#5df6ff"}
                />
                <DiceFace
                  n={b}
                  dead={revealed && isMine}
                  color={isPicked ? "#ff2d9d" : "#5df6ff"}
                />
              </div>
              <div className="dice-sum">{sum}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 8. PENGUIN RACE ── 4 lanes, pick which finishes safe
  // ===========================================================
  function PenguinSprite({ color, dead }) {
    return (
      <svg
        viewBox="0 0 16 16"
        width="100%"
        height="100%"
        shapeRendering="crispEdges"
      >
        <g fill={color}>
          <rect x="6" y="2" width="4" height="2" />
          <rect x="5" y="4" width="6" height="6" />
          <rect x="5" y="10" width="2" height="2" />
          <rect x="9" y="10" width="2" height="2" />
          <rect x="4" y="6" width="1" height="2" />
          <rect x="11" y="6" width="1" height="2" />
        </g>
        <rect x="6" y="6" width="4" height="3" fill="#fff" />
        <rect x="7" y="4" width="1" height="1" fill="#0b1226" />
        <rect x="8" y="4" width="1" height="1" fill="#0b1226" />
        <rect x="7" y="7" width="2" height="1" fill="#ffd24a" />
        {dead && (
          <g fill="#ff6b35">
            <rect x="6" y="11" width="4" height="1" />
            <rect x="5" y="12" width="6" height="2" />
          </g>
        )}
      </svg>
    );
  }
  function RaceView({ state, picks, onPick, revealed, locked }) {
    const colors = ["#5df6ff", "#ff2d9d", "#6fffb0", "#ffd24a"];
    const names = ["FROSTY", "NIPPER", "BLITZ", "TUNDRA"];
    return (
      <div className="mg-race">
        {[0, 1, 2, 3].map((i) => {
          const isMine = state.mines.includes(i);
          const isPicked = picks.includes(i);
          const finish = revealed
            ? isMine
              ? 0.55
              : state.positions
                ? state.positions[i]
                : 0.9
            : 0.05;
          let cls = "race-lane";
          if (isPicked && !revealed) cls += " picked";
          if (revealed) {
            cls += " thaw";
            if (isPicked && isMine) cls += " mine";
            else if (isPicked) cls += " safe";
          } else cls += " frozen";
          if (locked) cls += " locked";
          return (
            <div
              key={i}
              className={cls}
              onClick={() => !locked && !revealed && onPick(i)}
            >
              <div className="mg-veil" />
              <div className="race-track">
                <div className="race-finish" />
                <div
                  className="race-runner"
                  style={{ left: `calc(${finish * 100}% - 14px)` }}
                >
                  <PenguinSprite color={colors[i]} dead={revealed && isMine} />
                </div>
              </div>
              <div className="race-name" style={{ color: colors[i] }}>
                {String(i + 1)} · {names[i]}{" "}
                {isPicked && !revealed && <span className="race-tick">◆</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ===========================================================
  // 9. CRYO REELS ── 3 reels × 6 symbols (18 cells)
  // ===========================================================
  const REEL_SYMS = ["❄", "◆", "✦", "♠", "BTC", "☠"];
  function ReelsView({ state, picks, onPick, revealed, locked }) {
    return (
      <div className="mg-reels">
        {[0, 1, 2].map((reel) => (
          <div key={reel} className="reel-col">
            <div className="reel-label">R{reel + 1}</div>
            {Array.from({ length: 6 }, (_, row) => {
              const i = reel * 6 + row;
              const isMine = state.mines.includes(i);
              const isPicked = picks.includes(i);
              let cls = "reel-cell";
              if (isPicked && !revealed) cls += " picked";
              if (revealed) {
                cls += " thaw";
                if (isPicked && isMine) cls += " mine";
                else if (isPicked) cls += " safe";
              } else cls += " frozen";
              if (locked) cls += " locked";
              const sym = isMine ? "☠" : REEL_SYMS[row];
              return (
                <div
                  key={i}
                  className={cls}
                  onClick={() => !locked && !revealed && onPick(i)}
                >
                  <div className="mg-veil" />
                  <span className="sym" data-bitcoin={sym === "BTC" ? "1" : ""}>
                    {sym}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ===========================================================
  // REGISTRY
  // ===========================================================
  const GAMES = {
    minefield: {
      key: "minefield",
      name: "MINEFIELD",
      short: "MINE",
      color: "var(--frost)",
      cells: 25,
      defaultMines: 5,
      blurb: "the og · pick safe tiles in a 5×5 frost field",
      Icon: () => (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.8"
        >
          <rect x="3" y="3" width="18" height="18" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
      generate: (seed, n) => ({ mines: pickN(seed, 25, n) }),
      View: MinefieldView,
    },
    invaders: {
      key: "invaders",
      name: "BLOCK INVADERS",
      short: "INV",
      color: "var(--magenta)",
      cells: 24,
      defaultMines: 4,
      blurb: "pick squads that won't drop a laser on the chain",
      Icon: () => (
        <svg
          viewBox="0 0 16 16"
          width="22"
          height="22"
          shapeRendering="crispEdges"
          fill="currentColor"
        >
          <rect x="3" y="3" width="2" height="2" />
          <rect x="11" y="3" width="2" height="2" />
          <rect x="4" y="5" width="8" height="2" />
          <rect x="2" y="7" width="12" height="2" />
          <rect x="2" y="9" width="2" height="3" />
          <rect x="12" y="9" width="2" height="3" />
          <rect x="5" y="9" width="2" height="2" />
          <rect x="9" y="9" width="2" height="2" />
        </svg>
      ),
      generate: (seed, n) => {
        const r = mgRng(seed);
        return {
          mines: pickN(seed * 7 + 13, 24, n),
          kinds: Array.from({ length: 24 }, (_, i) => Math.floor(i / 6) % 3),
        };
      },
      View: InvadersView,
    },
    crush: {
      key: "crush",
      name: "FROST CRUSH",
      short: "CRUSH",
      color: "#6fffb0",
      cells: 25,
      defaultMines: 6,
      blurb: "match-3 with bombs · pick gems that survive the cascade",
      Icon: () => (
        <svg viewBox="0 0 20 20" width="22" height="22" fill="currentColor">
          <polygon points="10,2 17,7 14,17 6,17 3,7" />
        </svg>
      ),
      generate: (seed, n) => {
        const r = mgRng(seed);
        return {
          mines: pickN(seed * 11 + 7, 25, n),
          colors: Array.from({ length: 25 }, () => Math.floor(r() * 5)),
        };
      },
      View: CrushView,
    },
    icetris: {
      key: "icetris",
      name: "ICE-TRIS",
      short: "TRIS",
      color: "#ffd24a",
      cells: 25,
      defaultMines: 5,
      blurb: "fill the well · garbage pieces bust the line",
      Icon: () => (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <rect x="3" y="3" width="6" height="6" />
          <rect x="9" y="3" width="6" height="6" />
          <rect x="9" y="9" width="6" height="6" />
          <rect x="3" y="9" width="6" height="6" />
          <rect x="3" y="15" width="6" height="6" />
        </svg>
      ),
      generate: (seed, n) => {
        const r = mgRng(seed);
        return {
          mines: pickN(seed * 13 + 5, 25, n),
          tetros: Array.from({ length: 25 }, () => Math.floor(r() * 4)),
        };
      },
      View: IcetrisView,
    },
    plinko: {
      key: "plinko",
      name: "PLINKO DROP",
      short: "PLNK",
      color: "#a280ff",
      cells: 7,
      defaultMines: 2,
      blurb: "drop a snowball · pick the lane it lands cold",
      Icon: () => (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <circle cx="12" cy="4" r="2" />
          <circle cx="8" cy="9" r="1.5" />
          <circle cx="16" cy="9" r="1.5" />
          <circle cx="6" cy="14" r="1.5" />
          <circle cx="12" cy="14" r="1.5" />
          <circle cx="18" cy="14" r="1.5" />
          <rect x="3" y="19" width="18" height="3" />
        </svg>
      ),
      generate: (seed, n) => ({ mines: pickN(seed, 7, n) }),
      View: PlinkoView,
    },
    wheel: {
      key: "wheel",
      name: "CRYO WHEEL",
      short: "WHEL",
      color: "#ff2d9d",
      cells: 12,
      defaultMines: 3,
      blurb: "spin the frost wheel · cover wedges, dodge skulls",
      Icon: () => (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v9M21 12h-9M12 21v-9M3 12h9M18.4 5.6L12 12M18.4 18.4L12 12M5.6 18.4L12 12M5.6 5.6L12 12" />
        </svg>
      ),
      generate: (seed, n) => ({ mines: pickN(seed, 12, n) }),
      View: WheelView,
    },
    dice: {
      key: "dice",
      name: "HASH DICE",
      short: "DICE",
      color: "#5df6ff",
      cells: 11,
      defaultMines: 3,
      blurb: "2d6 prediction · sum is a hash mod hush",
      Icon: () => (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
          <rect x="11" y="11" width="10" height="10" rx="1.5" />
          <circle cx="6.5" cy="6.5" r="1" fill="#0b1226" />
          <circle cx="9.5" cy="9.5" r="1" fill="#0b1226" />
          <circle cx="14.5" cy="14.5" r="1" fill="#0b1226" />
          <circle cx="17.5" cy="17.5" r="1" fill="#0b1226" />
        </svg>
      ),
      generate: (seed, n) => ({ mines: pickN(seed, 11, n) }),
      View: DiceView,
    },
    race: {
      key: "race",
      name: "PENGUIN RACE",
      short: "RACE",
      color: "#6fffb0",
      cells: 4,
      defaultMines: 1,
      blurb: "pick the bird that doesn't faceplant",
      Icon: () => (
        <svg
          viewBox="0 0 16 16"
          width="22"
          height="22"
          shapeRendering="crispEdges"
          fill="currentColor"
        >
          <rect x="6" y="2" width="4" height="2" />
          <rect x="5" y="4" width="6" height="6" />
          <rect x="6" y="6" width="4" height="3" fill="#fff" />
          <rect x="5" y="10" width="2" height="2" />
          <rect x="9" y="10" width="2" height="2" />
        </svg>
      ),
      generate: (seed, n) => {
        const r = mgRng(seed);
        return {
          mines: pickN(seed, 4, n),
          positions: [0, 1, 2, 3].map(() => 0.6 + r() * 0.35),
        };
      },
      View: RaceView,
    },
    reels: {
      key: "reels",
      name: "CRYO REELS",
      short: "REEL",
      color: "#ffd24a",
      cells: 18,
      defaultMines: 4,
      blurb: "3-reel slot · pick stops that align with the block",
      Icon: () => (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="3" y="4" width="5" height="16" />
          <rect x="9.5" y="4" width="5" height="16" />
          <rect x="16" y="4" width="5" height="16" />
          <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
        </svg>
      ),
      generate: (seed, n) => ({ mines: pickN(seed, 18, n) }),
      View: ReelsView,
    },
  };

  const GAME_KEYS = [
    "minefield",
    "invaders",
    "crush",
    "icetris",
    "plinko",
    "wheel",
    "dice",
    "race",
    "reels",
  ];

  // expose
  Object.assign(window, { GAMES, GAME_KEYS, mgRng, pickN, shuffle });
})();
