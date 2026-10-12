// FROST-BITE :: NINE REAL GAMES — engine + games 1-5
// Contract: each game gets ({state, run, onScore, onBust, onDone, live, revealed})
// run = {score, busted, done}. Play NOW, the block CONFIRMS the payout.
(function () {
const { useState, useEffect, useRef, useCallback } = React;

// ---- shared loop: rAF when visible, timer fallback when the page is hidden ----
// A preview pane or background tab throttles rAF to zero. The cabinets must still run,
// so if rAF produces no frames we drive the same step function on an interval.
function useLoop(fn, active) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let raf = 0, iv = 0, last = performance.now(), frames = 0, stop = false;
    function step(t) {
      const now = t || performance.now();
      const dt = Math.min(50, now - last); last = now;
      frames++;
      try { ref.current(dt / 16.667, now); } catch (e) {}
    }
    function rafTick(t) { if (stop) return; step(t); raf = requestAnimationFrame(rafTick); }
    raf = requestAnimationFrame(rafTick);
    const probe = setTimeout(() => {
      if (frames === 0 && !stop) { cancelAnimationFrame(raf); iv = setInterval(() => step(), 33); }
    }, 200);
    return () => { stop = true; cancelAnimationFrame(raf); clearTimeout(probe); clearInterval(iv); };
  }, [active]);
}

// sizes a canvas ref to its CSS box in device pixels, and keeps it sized
function useFitCanvas(ref) {
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    function size() {
      const r = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
    size();
    const ro = new ResizeObserver(size); ro.observe(c);
    const t = setTimeout(size, 120);
    window.addEventListener("resize", size);
    return () => { ro.disconnect(); clearTimeout(t); window.removeEventListener("resize", size); };
  }, [ref]);
}
const rnd = (n) => Math.random() * n;
// ONE scale unit per cabinet. Every font, sprite and bar sizes off this, never off
// W or H directly — a 3.7:1 surface otherwise explodes text while collapsing geometry.
const unit = (W, H) => Math.min(W, H * 1.7);
const px = (v, floor = 2) => Math.max(floor, v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// GameShell: score chip + bust veil + tap-to-start
function Shell({ children, run, live, revealed, label, hint, color, armed, tip, lives }) {
  // `armed` is the cabinet's own first-input flag. Timed cabinets stay frozen until the
  // player engages, so an unattended board can never bust itself before they reach it.
  const engaged = armed === undefined ? run.started : (armed || run.started);
  return (
    <div className="gp" style={{ "--gc": color }}>
      {children}
      <div className="gp-hud">
        <span className="gp-score">{run.score}</span>
        <span className="gp-label">{label}</span>
        {lives != null && <span className="gp-lives">{"◆".repeat(Math.max(0, lives))}<i>{"◇".repeat(Math.max(0, 3 - lives))}</i></span>}
      </div>
      {tip && <div className="gp-tip" key={tip}>{tip}</div>}
      {!engaged && !revealed && live && <div className="gp-start">▸ {hint}</div>}
      {!engaged && !revealed && live && <div className="gp-frozen">FROZEN · WAITING FOR YOU</div>}
      {run.busted && <div className="gp-bust">✕ BUSTED</div>}
      {run.done && !run.busted && <div className="gp-clear">◆ CLEARED</div>}
      {revealed && <div className="gp-settled">{run.busted ? "NO PAYOUT" : "+" + run.score + " CONFIRMED"}</div>}
    </div>
  );
}

// =====================================================
// 1. RELEASE THE SATS — satchel drops sats through a peg maze into pits
// =====================================================
function ReleaseTheSats({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const [released, setReleased] = useState(false);
  const G = useRef({ sats: [], pegs: null, init: false, settled: 0, opening: 0, bins: null });
  const pits = state.pits;
  const TOTAL = 21;

  useEffect(() => {
    const g = G.current;
    if (g.init) return;
    // a proper Galton board: wide rows so sats can reach every pit
    g.pegs = [];
    for (let row = 0; row < 8; row++) {
      const n = 5 + row, off = (row % 2) * .5, y = .18 + row * .082;
      for (let i = 0; i < n; i++) g.pegs.push({ x: (i + off + .5) / n, y, r: .014 });
    }
    g.bins = new Array(pits.length).fill(0);
    g.init = true;
  }, []);

  useLoop((dt) => {
    const c = ref.current; if (!c) return;
    const g = G.current, W = c.width, H = c.height, ctx = c.getContext("2d");
    const U = unit(W, H);
    ctx.clearRect(0, 0, W, H);
    const AR = W / H;   // aspect correction so collisions are round, not oval

    // pegs
    for (const p of g.pegs) {
      const grd = ctx.createRadialGradient(p.x * W - 2, p.y * H - 2, 0, p.x * W, p.y * H, W * p.r * 1.6);
      grd.addColorStop(0, "#eaffff"); grd.addColorStop(.5, "#5df6ff"); grd.addColorStop(1, "rgba(46,107,255,.15)");
      ctx.beginPath(); ctx.fillStyle = grd;
      ctx.shadowBlur = 8; ctx.shadowColor = "#5df6ff";
      ctx.arc(p.x * W, p.y * H, px(U * p.r * 1.5, 1.5), 0, 7); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // satchel
    const open = g.opening;
    const bg = ctx.createLinearGradient(W * .34, 0, W * .66, H * .1);
    bg.addColorStop(0, "#6b4f28"); bg.addColorStop(.5, "#c9a54e"); bg.addColorStop(1, "#6b4f28");
    ctx.fillStyle = bg; ctx.fillRect(W * .34, H * .012, W * .32, H * .072);
    ctx.fillStyle = "#04060d";
    ctx.fillRect(W * (.42 - open * .06), H * .075, W * (.16 + open * .12), H * .012 * (1 + open * 2.5));
    if (!released) {
      ctx.fillStyle = "#ffd24a"; ctx.font = `${px(U * .055, 7)}px VT323`; ctx.textAlign = "center";
      ctx.fillText("21 SATS", W * .5, H * .06);
    }

    // pits
    const pw = W / pits.length;
    for (let i = 0; i < pits.length; i++) {
      const trap = pits[i] === 1;
      const pg = ctx.createLinearGradient(0, H * .86, 0, H);
      if (trap) { pg.addColorStop(0, "rgba(255,107,53,.45)"); pg.addColorStop(1, "rgba(120,20,4,.7)"); }
      else { pg.addColorStop(0, "rgba(111,255,176,.3)"); pg.addColorStop(1, "rgba(10,60,40,.6)"); }
      ctx.fillStyle = pg; ctx.fillRect(i * pw + 2, H * .86, pw - 4, H * .14);
      ctx.strokeStyle = trap ? "#ff6b35" : "#6fffb0"; ctx.lineWidth = 1.5;
      ctx.strokeRect(i * pw + 2, H * .86, pw - 4, H * .14);
      ctx.fillStyle = trap ? "#ff6b35" : "#6fffb0";
      ctx.font = `${px(U * .055, 7)}px VT323`; ctx.textAlign = "center";
      ctx.fillText(trap ? "☠" : "+" + (i === 3 ? 5 : 2), i * pw + pw / 2, H * .935);
      if (g.bins && g.bins[i]) {
        ctx.fillStyle = "#fff"; ctx.font = `${px(U * .046, 6)}px VT323`;
        ctx.fillText("×" + g.bins[i], i * pw + pw / 2, H * .985);
      }
    }

    if (open < 1 && released) g.opening = Math.min(1, open + dt * .09);

    // ---- physics ----
    for (const s of g.sats) {
      if (s.delay > 0) { s.delay -= dt; continue; }
      if (!s.landed) {
        s.vy += .05 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= .996;
        // circle-vs-circle against every peg, resolved along the true normal
        for (const p of g.pegs) {
          const dx = (s.x - p.x) * AR, dy = s.y - p.y;
          const d = Math.hypot(dx, dy), min = (p.r + .012) * 1;
          if (d < min && d > 0.00001) {
            const nx = dx / d, ny = dy / d;
            // push out of the peg
            s.x += (nx * (min - d)) / AR; s.y += ny * (min - d);
            // reflect with restitution, plus a small tangential kick so identical
            // entry conditions still diverge — this is what breaks the clumping
            const vn = s.vx * AR * nx + s.vy * ny;
            const rest = .52 + Math.random() * .16;
            s.vx -= (1 + rest) * vn * nx / AR;
            s.vy -= (1 + rest) * vn * ny;
            s.vx += (Math.random() - .5) * .006;
            s.spin += (Math.random() - .5) * .4;
          }
        }
        if (s.x < .015) { s.x = .015; s.vx = Math.abs(s.vx) * .7; }
        if (s.x > .985) { s.x = .985; s.vx = -Math.abs(s.vx) * .7; }
        if (s.y > .875) {
          s.landed = true;
          const pit = clamp(Math.floor(s.x * pits.length), 0, pits.length - 1);
          s.trap = pits[pit] === 1;
          s.y = .9 + Math.random() * .07;
          s.x = (pit + .18 + Math.random() * .64) / pits.length;
          g.settled++; g.bins[pit] = (g.bins[pit] || 0) + 1;
          if (s.trap) onBust(); else onScore(pit === 3 ? 5 : 2);
        }
      }
      const rad = px(U * .018, 2);
      const sg = ctx.createRadialGradient(s.x * W - rad * .35, s.y * H - rad * .35, 0, s.x * W, s.y * H, rad);
      const base = s.landed ? (s.trap ? "#ff6b35" : "#6fffb0") : "#ffd24a";
      sg.addColorStop(0, "#fff"); sg.addColorStop(.45, base); sg.addColorStop(1, "rgba(0,0,0,.35)");
      ctx.beginPath(); ctx.fillStyle = sg;
      ctx.shadowBlur = s.landed ? 4 : 10; ctx.shadowColor = base;
      ctx.arc(s.x * W, s.y * H, rad, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (released) {
      ctx.fillStyle = "rgba(93,246,255,.85)"; ctx.font = `${px(U * .062, 8)}px VT323`; ctx.textAlign = "left";
      ctx.fillText(g.settled + " / " + TOTAL, 8, H * .07);
    }
  }, live && !revealed);

  function release() {
    if (!live || revealed || released) return;
    const g = G.current;
    // spread the release across the FULL mouth with genuinely varied velocity,
    // so the 21 fan out instead of tracking one another down the same channel
    g.sats = Array.from({ length: TOTAL }, (_, i) => ({
      x: .30 + Math.random() * .40,
      y: .095 + Math.random() * .02,
      vx: (Math.random() - .5) * .034,
      vy: Math.random() * .006,
      spin: Math.random() * 6,
      delay: Math.random() * 14,
      landed: false, trap: false,
    }));
    setReleased(true);
  }

  return (
    <Shell run={run} live={live} revealed={revealed} color="#ffd24a" armed={released}
           label="SATS SETTLED" hint="TAP TO RELEASE ALL 21 SATS">
      <canvas ref={ref} className="gp-canvas" onClick={release} onTouchStart={release}/>
    </Shell>
  );
}

// =====================================================
// 2. SOLVE THE MAZE — generative maze, reach the exit before the block
// =====================================================
const MZ = 9;
function genMaze(seed) {
  let s = seed >>> 0 || 7;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  // walls[y][x] = {n,e,s,w} true = wall
  const cells = Array.from({ length: MZ }, () => Array.from({ length: MZ }, () => ({ n: 1, e: 1, s: 1, w: 1, v: 0 })));
  const stack = [[0, 0]]; cells[0][0].v = 1;
  const D = [["n", 0, -1, "s"], ["e", 1, 0, "w"], ["s", 0, 1, "n"], ["w", -1, 0, "e"]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = D.filter(([, dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < MZ && ny < MZ && !cells[ny][nx].v;
    });
    if (!opts.length) { stack.pop(); continue; }
    const [d, dx, dy, od] = opts[Math.floor(r() * opts.length)];
    cells[y][x][d] = 0; cells[y + dy][x + dx][od] = 0; cells[y + dy][x + dx].v = 1;
    stack.push([x + dx, y + dy]);
  }
  // sats + traps — all coordinates clamped into 0..MZ-1, and traps kept off the
  // start cell, the exit, and any sat. A trap you cannot see and did not choose to
  // enter is not difficulty, it is a coin flip.
  const sats = [], traps = [];
  const taken = new Set(["0,0", (MZ - 1) + "," + (MZ - 1)]);
  const cell = (min) => {
    const span = MZ - min;
    return [min + Math.floor(r() * span), min + Math.floor(r() * span)].map((v) => Math.min(MZ - 1, v));
  };
  for (let i = 0; i < 6; i++) {
    for (let tries = 0; tries < 24; tries++) {
      const [x, y] = cell(1), k = x + "," + y;
      if (taken.has(k)) continue;
      taken.add(k); sats.push([x, y]); break;
    }
  }
  for (let i = 0; i < 4; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const [x, y] = cell(2), k = x + "," + y;
      if (taken.has(k)) continue;
      if (x + y < 3) continue;                     // start must stay survivable
      const c = cells[y][x];
      const openings = (c.n ? 0 : 1) + (c.e ? 0 : 1) + (c.s ? 0 : 1) + (c.w ? 0 : 1);
      if (openings < 3) continue;                  // never a dead end or a sole corridor
      taken.add(k); traps.push([x, y]); break;
    }
  }
  return { cells, sats, traps };
}
function SolveTheMaze({ state, run, onScore, onBust, onDone, live, revealed }) {
  const [pos, setPos] = useState([0, 0]);
  const [got, setGot] = useState([]);
  const m = state.maze;
  // A board rebuild swaps in a NEW maze while React keeps this component (same key).
  // Without this the second round starts wherever the last one ended — frequently
  // standing on a trap in a maze the player has never seen.
  useEffect(() => { setPos([0, 0]); setGot([]); }, [m]);
  const move = useCallback((dx, dy) => {
    if (!live || revealed || run.busted || run.done) return;
    const [x, y] = pos;
    const c = m.cells[y][x];
    if (dx === 1 && c.e) return;
    if (dx === -1 && c.w) return;
    if (dy === 1 && c.s) return;
    if (dy === -1 && c.n) return;
    const nx = clamp(x + dx, 0, MZ - 1), ny = clamp(y + dy, 0, MZ - 1);
    if (nx === x && ny === y) return;
    const key = nx + "," + ny;
    setPos([nx, ny]);
    if (m.traps.some(([tx, ty]) => tx === nx && ty === ny)) { onBust(); return; }
    if (m.sats.some(([sx, sy]) => sx === nx && sy === ny) && !got.includes(key)) {
      setGot((gg) => gg.includes(key) ? gg : [...gg, key]);
      onScore(3);
    }
    if (nx === MZ - 1 && ny === MZ - 1) { onScore(10); onDone(); }
  }, [m, got, pos, live, revealed, run.busted, run.done, onScore, onBust, onDone]);

  useEffect(() => {
    if (!live) return;
    function k(e) {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const v = map[e.key] || map[e.key.toLowerCase()];
      if (v) { e.preventDefault(); move(v[0], v[1]); }
    }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [move, live]);
  return (
    <Shell run={run} live={live} revealed={revealed} color="#a280ff"
           label="MAZE" hint="WASD / ARROWS · ☠ IS VISIBLE · REACH ▣">
      <div className="mz" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * MZ, cy = (e.clientY - r.top) / r.height * MZ;
        const dx = cx - pos[0] - .5, dy = cy - pos[1] - .5;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0); else move(0, dy > 0 ? 1 : -1);
      }}>
        {m.cells.map((row, y) => row.map((c, x) => {
          const key = x + "," + y;
          const isSat = m.sats.some(([sx, sy]) => sx === x && sy === y) && !got.includes(key);
          const isTrap = m.traps.some(([tx, ty]) => tx === x && ty === y);
          const near = m.traps.filter(([tx, ty]) => Math.abs(tx - x) <= 1 && Math.abs(ty - y) <= 1).length;
          return (
            <div key={key} className="mz-c"
                 style={{
                   gridColumn: x + 1, gridRow: y + 1,
                   borderTopColor: c.n ? "#5df6ff" : "transparent",
                   borderRightColor: c.e ? "#5df6ff" : "transparent",
                   borderBottomColor: c.s ? "#5df6ff" : "transparent",
                   borderLeftColor: c.w ? "#5df6ff" : "transparent",
                 }}>
              {isSat && <span className="mz-sat">◆</span>}
              {!isTrap && !isSat && near > 0 && <span className="mz-near" data-n={near}>{near}</span>}
              {isTrap && <span className="mz-trap">☠</span>}
              {x === MZ - 1 && y === MZ - 1 && <span className="mz-exit">▣</span>}
              {pos[0] === x && pos[1] === y && <span className="mz-you"/>}
            </div>
          );
        }))}
      </div>
    </Shell>
  );
}

// =====================================================
// 3. BLOCK BUSTER — slide rows/cols to build the longest colour chain
// =====================================================
const BB = 6;
function BlockBuster({ state, run, onScore, live, revealed }) {
  const [grid, setGrid] = useState(state.grid);
  const [best, setBest] = useState(0);
  const [chain, setChain] = useState([]);
  const COL = ["#5df6ff", "#ff2d9d", "#6fffb0", "#ffd24a", "#a280ff"];

  function longest(g) {
    let bestRun = [], seen = new Set();
    function flood(i, c) {
      const stack = [i], out = [];
      const local = new Set();
      while (stack.length) {
        const k = stack.pop();
        if (local.has(k) || g[k] !== c) continue;
        local.add(k); out.push(k);
        const x = k % BB, y = (k / BB) | 0;
        if (x > 0) stack.push(k - 1);
        if (x < BB - 1) stack.push(k + 1);
        if (y > 0) stack.push(k - BB);
        if (y < BB - 1) stack.push(k + BB);
      }
      return out;
    }
    for (let i = 0; i < g.length; i++) {
      if (seen.has(i)) continue;
      const grp = flood(i, g[i]);
      grp.forEach((k) => seen.add(k));
      if (grp.length > bestRun.length) bestRun = grp;
    }
    return bestRun;
  }
  function slide(kind, ix, dir) {
    if (!live || revealed) return;
    const g = grid.slice();
    if (kind === "r") {
      const row = []; for (let x = 0; x < BB; x++) row.push(g[ix * BB + x]);
      const rot = dir > 0 ? [row[BB - 1], ...row.slice(0, -1)] : [...row.slice(1), row[0]];
      for (let x = 0; x < BB; x++) g[ix * BB + x] = rot[x];
    } else {
      const col = []; for (let y = 0; y < BB; y++) col.push(g[y * BB + ix]);
      const rot = dir > 0 ? [col[BB - 1], ...col.slice(0, -1)] : [...col.slice(1), col[0]];
      for (let y = 0; y < BB; y++) g[y * BB + ix] = rot[y];
    }
    const L = longest(g);
    setGrid(g);
    setChain(L);
    if (L.length > best) { onScore((L.length - best) * 2); setBest(L.length); }
  }

  return (
    <Shell run={run} live={live} revealed={revealed} color="#6fffb0"
           label={"CHAIN " + best} hint="SLIDE ROWS & COLS · BUILD A CHAIN">
      <div className="bb">
        <div className="bb-grid">
          {grid.map((c, i) => (
            <div key={i} className={"bb-c" + (chain.includes(i) ? " on" : "")}
                 style={{ background: COL[c], "--bc": COL[c] }}/>
          ))}
        </div>
        <div className="bb-rails r">
          {Array.from({ length: BB }, (_, y) => (
            <div key={y} className="bb-rail">
              <button onClick={() => slide("r", y, -1)}>◂</button>
              <button onClick={() => slide("r", y, 1)}>▸</button>
            </div>
          ))}
        </div>
        <div className="bb-rails c">
          {Array.from({ length: BB }, (_, x) => (
            <div key={x} className="bb-rail v">
              <button onClick={() => slide("c", x, -1)}>▴</button>
              <button onClick={() => slide("c", x, 1)}>▾</button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// =====================================================
// 4. ZAPPER — first-person laser, bust blocks, collect fire, crack glaciers
// =====================================================
// weapon progression: kills earn barrels, then a screen-clearing burst
const ZAP_TIERS = [
  { at: 0,  barrels: 1, name: "SINGLE",  spread: 0,    color: "#ff2d9d" },
  { at: 4,  barrels: 2, name: "TWIN",    spread: .055, color: "#ff6b35" },
  { at: 10, barrels: 3, name: "TRIPLE",  spread: .075, color: "#ffd24a" },
  { at: 18, barrels: 4, name: "QUAD",    spread: .095, color: "#6fffb0" },
  { at: 28, barrels: 5, name: "OVERLOAD",spread: .12,  color: "#8effff" },
];
function zapTier(kills) {
  let t = ZAP_TIERS[0];
  for (const x of ZAP_TIERS) if (kills >= x.at) t = x;
  return t;
}
function Zapper({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const [armed, setArmed] = useState(false);
  const [kills, setKills] = useState(0);
  const [tierName, setTierName] = useState("SINGLE");
  const [burstReady, setBurstReady] = useState(false);
  const armedRef = useRef(false);
  const killRef = useRef(0);
  const G = useRef({ blocks: null, aim: { x: .5, y: .5 }, shots: [], heat: 0, init: false, t: 0,
                     wave: 1, banner: null, burst: 0, charge: 0 });

  useEffect(() => {
    const g = G.current; if (g.init) return;
    g.blocks = Array.from({ length: 10 }, (_, i) => ({
      x: .1 + rnd(.8), y: .15 + rnd(.5), z: .75 + rnd(1.4),
      kind: i % 5 === 0 ? "glacier" : i % 4 === 0 ? "fire" : i % 7 === 0 ? "mine" : "block",
      dead: 0, ph: rnd(6),
    }));
    g.init = true;
  }, []);

  function banner(text, color) {
    G.current.banner = { text, color, life: 1 };
  }

  useLoop((dt, t) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height;
    const U = unit(W, H);
    const g = G.current; g.t += dt;
    const tier = zapTier(killRef.current);
    ctx.clearRect(0, 0, W, H);

    // corridor with depth gradient
    const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .8);
    grd.addColorStop(0, "rgba(70,140,255,.26)");
    grd.addColorStop(.55, "rgba(20,40,110,.2)");
    grd.addColorStop(1, "rgba(4,6,13,.96)");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    for (let i = 1; i < 10; i++) {
      const p = ((g.t * .004 + i / 10) % 1), s = p * p;
      ctx.strokeStyle = `rgba(93,246,255,${.05 + s * .16})`;
      ctx.lineWidth = 1 + s;
      ctx.strokeRect(W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s);
    }

    // blocks
    for (const b of g.blocks) {
      if (b.dead > 0) { b.dead -= dt * .06; continue; }
      if (armedRef.current) {
        b.z -= dt * .0013 * (1 + g.wave * .1);
        if (b.z < .16) { onBust(); b.dead = 1; }
      }
      const s = 1 / b.z, sz = U * .09 * s;
      const px = W / 2 + (b.x - .5) * W * s, py = H / 2 + (b.y - .5) * H * s;
      const col = b.kind === "mine" ? "#ff2d9d" : b.kind === "fire" ? "#ff6b35"
                : b.kind === "glacier" ? "#8effff" : "#5df6ff";
      ctx.save();
      ctx.translate(px, py); ctx.rotate(Math.sin(g.t * .02 + b.ph) * .22);
      const bgr = ctx.createLinearGradient(-sz / 2, -sz / 2, sz / 2, sz / 2);
      bgr.addColorStop(0, "#ffffff"); bgr.addColorStop(.35, col); bgr.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = bgr;
      ctx.globalAlpha = clamp(1.15 - b.z * .45, .25, 1);
      ctx.shadowBlur = 16; ctx.shadowColor = col;
      if (b.kind === "glacier") {
        ctx.beginPath(); ctx.moveTo(0, -sz / 1.35); ctx.lineTo(sz / 1.5, 0);
        ctx.lineTo(0, sz / 1.35); ctx.lineTo(-sz / 1.5, 0); ctx.closePath(); ctx.fill();
      } else ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.fillStyle = "#04060d"; ctx.font = `${px(sz * .55, 6)}px VT323`; ctx.textAlign = "center";
      ctx.fillText(b.kind === "mine" ? "☠" : b.kind === "fire" ? "▲" : b.kind === "glacier" ? "❄" : "", 0, sz * .18);
      ctx.restore();
    }

    // shots — one beam per barrel
    for (const s of g.shots) {
      s.life -= dt * .075;
      ctx.strokeStyle = `rgba(255,255,255,${clamp(s.life, 0, 1) * .9})`;
      ctx.lineWidth = 4.5 * s.life; ctx.shadowBlur = 18; ctx.shadowColor = s.col || tier.color;
      ctx.beginPath(); ctx.moveTo(s.ox * W, H); ctx.lineTo(s.x * W, s.y * H); ctx.stroke();
      ctx.strokeStyle = `${s.col || tier.color}`; ctx.lineWidth = 2 * s.life;
      ctx.beginPath(); ctx.moveTo(s.ox * W, H); ctx.lineTo(s.x * W, s.y * H); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    g.shots = g.shots.filter((s) => s.life > 0);

    // full-clear burst
    if (g.burst > 0) {
      g.burst -= dt * .05;
      const r = (1 - g.burst) * W * 1.3;
      ctx.strokeStyle = `rgba(142,255,255,${g.burst})`; ctx.lineWidth = 10 * g.burst;
      ctx.shadowBlur = 40; ctx.shadowColor = "#8effff";
      ctx.beginPath(); ctx.arc(W / 2, H, r, Math.PI, 0); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // crosshair — grows with the weapon tier
    const ax = g.aim.x * W, ay = g.aim.y * H;
    ctx.strokeStyle = tier.color; ctx.lineWidth = 1.6;
    ctx.shadowBlur = 10; ctx.shadowColor = tier.color;
    ctx.beginPath(); ctx.arc(ax, ay, W * (.03 + tier.barrels * .006), 0, 7); ctx.stroke();
    for (let b = 0; b < tier.barrels; b++) {
      const off = (b - (tier.barrels - 1) / 2) * tier.spread * W;
      ctx.beginPath(); ctx.moveTo(ax + off, ay - U * .07); ctx.lineTo(ax + off, ay - U * .026); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // HUD: tier + heat + wave
    ctx.textAlign = "left";
    ctx.fillStyle = tier.color; ctx.font = `${px(U * .058, 7)}px "Press Start 2P", monospace`;
    ctx.fillText(tier.name, 6, H - px(U * .075, 9));
    ctx.fillStyle = "rgba(93,246,255,.7)"; ctx.font = `${px(U * .06, 8)}px VT323`;
    ctx.fillText("WAVE " + g.wave, 6, H - 3);
    if (g.heat > 0) {
      const barH = px(U * .045, 4), barY = H - barH - 3, barX = W * .34, barW = W * .62;
      const hg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      hg.addColorStop(0, "#ff6b35"); hg.addColorStop(1, "#ffd24a");
      ctx.fillStyle = hg;
      ctx.fillRect(barX, barY, barW * clamp(g.heat / 5, 0, 1), barH);
      ctx.strokeStyle = "rgba(255,107,53,.6)"; ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // tip banner
    if (g.banner) {
      g.banner.life -= dt * .012;
      if (g.banner.life <= 0) g.banner = null;
      else {
        ctx.textAlign = "center";
        ctx.globalAlpha = clamp(g.banner.life, 0, 1);
        ctx.fillStyle = g.banner.color;
        ctx.font = `${px(U * .07, 8)}px "Press Start 2P", monospace`;
        ctx.shadowBlur = 20; ctx.shadowColor = g.banner.color;
        ctx.fillText(g.banner.text, W / 2, H * .34);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
  }, live && !revealed && !run.busted);

  function aimAt(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const cy = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (cx == null) return null;
    return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
  }
  function respawn(b, g) {
    b.x = .1 + rnd(.8); b.y = .15 + rnd(.5); b.z = 1.5 + rnd(.8); b.dead = 0;
    const roll = Math.random();
    b.kind = roll < .12 ? "mine" : roll < .34 ? "fire" : roll < .5 ? "glacier" : "block";
  }
  function fire(e) {
    if (!live || revealed || run.busted) return;
    if (!armedRef.current) { armedRef.current = true; setArmed(true); banner("ENGAGE", "#ff2d9d"); }
    const a = aimAt(e); if (!a) return;
    const g = G.current; g.aim = a;
    const tier = zapTier(killRef.current);

    // one beam per barrel, each testing its own lane
    let hits = 0;
    for (let bi = 0; bi < tier.barrels; bi++) {
      const off = (bi - (tier.barrels - 1) / 2) * tier.spread;
      const lane = { x: clamp(a.x + off, 0, 1), y: a.y };
      g.shots.push({ x: lane.x, y: lane.y, ox: .5 + off * .6, life: 1, col: tier.color });
      let hit = null, bestZ = 9;
      for (const b of g.blocks) {
        if (b.dead > 0) continue;
        const s = 1 / b.z, sz = .07 * s * 1.45;
        const px = .5 + (b.x - .5) * s, py = .5 + (b.y - .5) * s;
        if (Math.abs(lane.x - px) < sz && Math.abs(lane.y - py) < sz && b.z < bestZ) { hit = b; bestZ = b.z; }
      }
      if (!hit) continue;
      hits++;
      hit.dead = 1;
      if (hit.kind === "mine") { onBust(); }
      else if (hit.kind === "fire") { g.heat = clamp(g.heat + 1, 0, 5); onScore(2); }
      else if (hit.kind === "glacier") { onScore(g.heat >= 3 ? 12 : 4); g.heat = 0; }
      else onScore(1 + Math.floor(g.heat));
      setTimeout(() => respawn(hit, g), 700);
    }

    if (hits > 0) {
      const before = zapTier(killRef.current);
      killRef.current += hits;
      setKills(killRef.current);
      const after = zapTier(killRef.current);
      if (after.name !== before.name) {
        setTierName(after.name);
        banner(after.barrels + "× " + after.name, after.color);
        onScore(5);
      }
      // full clear burst every 12 kills
      if (Math.floor(killRef.current / 12) > Math.floor((killRef.current - hits) / 12)) {
        g.burst = 1;
        banner("FULL CLEAR BURST", "#8effff");
        let cleared = 0;
        for (const b of g.blocks) {
          if (b.dead > 0 || b.kind === "mine") continue;
          b.dead = 1; cleared++;
          setTimeout(() => respawn(b, g), 900);
        }
        onScore(cleared * 3);
        g.wave++;
        setBurstReady(false);
      } else if (killRef.current % 12 >= 9) setBurstReady(true);
    }
  }
  return (
    <Shell run={run} live={live} revealed={revealed} color="#ff2d9d" armed={armed}
           label={tierName + (burstReady ? " · BURST READY" : "")}
           hint="TAP TO ZAP · KILLS EARN BARRELS · ▲ HEATS · ❄ PAYS BIG">
      <canvas ref={ref} className="gp-canvas" onClick={fire}
              onMouseMove={(e) => { const a = aimAt(e); if (a) G.current.aim = a; }}
              onTouchStart={fire}/>
    </Shell>
  );
}

// =====================================================
// 5. ICE BREAKER — paddle + ball, smash the ice wall
// =====================================================
function IceBreaker({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const G = useRef({ b: null, px: .5, bricks: null, init: false });
  useEffect(() => {
    const g = G.current; if (g.init) return;
    g.b = { x: .5, y: .6, vx: .008, vy: -.011 };
    g.bricks = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 7; x++)
      g.bricks.push({ x, y, hp: y === 0 ? 2 : 1, mine: state.mines.includes(y * 7 + x) });
    g.init = true;
  }, []);
  useLoop((dt) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, g = G.current;
    const U = unit(W, H);
    ctx.clearRect(0, 0, W, H);
    const bw = W / 7, bh = Math.max(5, H * .055);
    for (const b of g.bricks) {
      if (b.hp <= 0) continue;
      const col = b.mine && (revealed || run.busted) ? "#ff6b35" : b.hp > 1 ? "#8effff" : "#5df6ff";
      ctx.fillStyle = col; ctx.globalAlpha = .85;
      ctx.fillRect(b.x * bw + 2, H * .1 + b.y * bh + 2, bw - 4, bh - 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.3)";
      ctx.strokeRect(b.x * bw + 2, H * .1 + b.y * bh + 2, bw - 4, bh - 4);
    }
    // ball — parked on the paddle until the player engages
    const b = g.b;
    if (!armedRef.current) { b.x = g.px; b.y = .915; b.vx = .008; b.vy = -.011; }
    else { b.x += b.vx * dt; b.y += b.vy * dt; }
    if (b.x < .02 || b.x > .98) b.vx *= -1;
    if (b.y < .02) b.vy *= -1;
    // paddle
    const pw = .22;
    if (b.y > .93 && b.y < .97 && Math.abs(b.x - g.px) < pw / 2) {
      b.vy = -Math.abs(b.vy); b.vx += (b.x - g.px) * .012;
    }
    if (armedRef.current && b.y > 1.02) { onBust(); b.y = .6; b.x = .5; b.vy = -.011; }
    // brick collide
    for (const br of g.bricks) {
      if (br.hp <= 0) continue;
      const bx0 = br.x / 7, bx1 = (br.x + 1) / 7;
      const by0 = .1 + br.y * (bh / H), by1 = by0 + bh / H;
      if (b.x > bx0 && b.x < bx1 && b.y > by0 && b.y < by1) {
        b.vy *= -1; br.hp--;
        if (br.hp <= 0) { if (br.mine) onBust(); else onScore(br.y === 0 ? 3 : 1); }
        break;
      }
    }
    ctx.fillStyle = "#ffd24a"; ctx.shadowBlur = 12; ctx.shadowColor = "#ffd24a";
    ctx.beginPath(); ctx.arc(b.x * W, b.y * H, px(U * .022, 2.5), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#6fffb0"; ctx.shadowBlur = 10; ctx.shadowColor = "#6fffb0";
    ctx.fillRect((g.px - pw / 2) * W, H * .95, pw * W, px(U * .03, 3)); ctx.shadowBlur = 0;
  }, live && !revealed && !run.busted);
  function track(e) {
    if (!live) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
    if (cx != null) G.current.px = clamp((cx - r.left) / r.width, .11, .89);
  }
  function launch(e) {
    if (!live || revealed || run.busted) return;
    track(e);
    if (!armedRef.current) { armedRef.current = true; setArmed(true); }
  }
  return (
    <Shell run={run} live={live} revealed={revealed} color="#8effff" armed={armed}
           label="BRICKS" hint="TAP TO SERVE · MOVE TO AIM">
      <canvas ref={ref} className="gp-canvas" onMouseMove={track} onTouchMove={track} onClick={launch} onTouchStart={launch}/>
    </Shell>
  );
}

Object.assign(window, { useLoop, useFitCanvas, Shell, genMaze, MZ, BB, clamp, rnd, unit, px,
  ReleaseTheSats, SolveTheMaze, BlockBuster, Zapper, IceBreaker });
})();
