// FROST-BITE :: NINE REAL GAMES — games 6-9 + the registry
(function () {
const { useState, useEffect, useRef, useCallback } = React;

// =====================================================
// 6. SAT SNAKE — grow the chain, dodge your own tail and the mines
// =====================================================
const SN = 12;
function SatSnake({ state, run, onScore, onBust, live, revealed }) {
  const [snake, setSnake] = useState([[6, 6], [5, 6], [4, 6]]);
  const snakeRef = useRef(snake); snakeRef.current = snake;
  const [food, setFood] = useState([9, 4]);
  const dir = useRef([1, 0]);
  const mines = state.snakeMines;
  const [armed, setArmed] = useState(false);
  const alive = live && !revealed && !run.busted && armed;

  useEffect(() => {
    if (!alive) return;
    const speed = Math.max(120, 260 - snakeRef.current.length * 5);
    const iv = setInterval(() => {
      const s = snakeRef.current;
      const [dx, dy] = dir.current;
      const h = [(s[0][0] + dx + SN) % SN, (s[0][1] + dy + SN) % SN];
      if (s.some(([x, y]) => x === h[0] && y === h[1])) { onBust(); return; }
      if (mines.some(([x, y]) => x === h[0] && y === h[1])) { onBust(); return; }
      const ate = h[0] === food[0] && h[1] === food[1];
      if (ate) {
        onScore(2);
        let nf, guard = 0;
        do { nf = [Math.floor(Math.random() * SN), Math.floor(Math.random() * SN)]; guard++; }
        while (guard < 60 && s.some(([x, y]) => x === nf[0] && y === nf[1]));
        setFood(nf);
      }
      setSnake(ate ? [h, ...s] : [h, ...s.slice(0, -1)]);
    }, 235);
    return () => clearInterval(iv);
  }, [alive, food, mines]);

  useEffect(() => {
    if (!live) return;
    function k(e) {
      const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const v = m[e.key] || m[e.key.toLowerCase()];
      if (!v) return;
      e.preventDefault();
      setArmed(true);
      if (v[0] === -dir.current[0] && v[1] === -dir.current[1]) return;
      dir.current = v;
    }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [live]);

  return (
    <Shell run={run} live={live} revealed={revealed} color="#6fffb0" armed={armed}
           label={"LENGTH " + snake.length} hint="WASD OR TAP A DIRECTION · ☠ IS VISIBLE">
      <div className="sn" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * SN, cy = (e.clientY - r.top) / r.height * SN;
        const dx = cx - snake[0][0], dy = cy - snake[0][1];
        const v = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
        setArmed(true);
        if (!(v[0] === -dir.current[0] && v[1] === -dir.current[1])) dir.current = v;
      }}>
        {Array.from({ length: SN * SN }, (_, i) => {
          const x = i % SN, y = (i / SN) | 0;
          const si = snake.findIndex(([sx, sy]) => sx === x && sy === y);
          const isFood = food[0] === x && food[1] === y;
          const isMine = mines.some(([mx, my]) => mx === x && my === y);
          return (
            <div key={i} className={"sn-c" + (si === 0 ? " head" : si > 0 ? " body" : "")}
                 style={si > 0 ? { opacity: Math.max(.35, 1 - si * .05) } : undefined}>
              {isFood && <span className="sn-food">◆</span>}
              {isMine && <span className="sn-mine" data-live={!revealed && !run.busted ? "1" : undefined}>☠</span>}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// =====================================================
// 7. GLACIER CLIMB — hop the ledges before the block lands
// =====================================================
// A ledge at rung i. Rung 0 is the ground; higher rungs are HIGHER ALTITUDE.
// Altitude is stored as a positive number that only grows — the old version tracked a
// screen-space camera which read as sliding downward. Now: altitude up, view follows.
function makeRung(i) {
  const band = Math.floor(i / 10);                       // difficulty band
  const w = Math.max(.14, .30 - band * .016) + Math.random() * .06;
  const kind = i === 0 ? "ground"
    : i % 10 === 0 ? "summit"                            // a summit every 10 rungs
    : i % 7 === 0 ? "hazard"
    : i % 3 === 0 ? "sat" : "ice";
  return { i, alt: i * 0.9, x: .05 + Math.random() * (.9 - w), w, kind, got: 0 };
}
function GlacierClimb({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const G = useRef({ init: false, rungs: [], top: 0, alt: 0, vy: 0, x: .5, vx: 0,
                     best: 0, summits: 0, banner: null, standing: 0 });

  useEffect(() => {
    const g = G.current; if (g.init) return;
    for (let i = 0; i < 40; i++) g.rungs.push(makeRung(i));
    g.top = 39; g.alt = 0; g.x = .5; g.init = true;
  }, []);

  function banner(text, color) { G.current.banner = { text, color, life: 1 }; }

  useLoop((dt) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, g = G.current;
    const U = unit(W, H);

    // ---- vertical world: altitude increases upward ----
    // The player sits at a fixed screen line; the world scrolls DOWN past them as
    // altitude rises. viewAlt = the altitude drawn at the player's line.
    const PLAYER_LINE = .68;              // where the climber is drawn
    const SPAN = 4.2;                     // altitude units visible on screen
    if (armedRef.current) {
      g.vy -= .0022 * dt;                 // gravity pulls altitude DOWN
      g.alt += g.vy * dt;
      g.x = clamp(g.x + g.vx * dt, .03, .97);
      g.vx *= .9;
      if (g.alt < 0) { g.alt = 0; g.vy = 0; }
    }
    const viewAlt = g.alt;
    const altToY = (a) => (PLAYER_LINE - (a - viewAlt) / SPAN) * H;

    // background: cold at the base, deep space at altitude
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    const hi = clamp(g.alt / 90, 0, 1);
    sky.addColorStop(0, `rgba(${4 + hi * 10},${8 + hi * 4},${26 + hi * 30},1)`);
    sky.addColorStop(1, `rgba(${14 - hi * 8},${34 - hi * 20},${70 - hi * 40},1)`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // stars appear as you climb
    if (hi > .12) {
      ctx.fillStyle = `rgba(255,255,255,${hi * .8})`;
      for (let s = 0; s < 26; s++) {
        const sx = ((s * 137) % 100) / 100 * W;
        const sy = (((s * 71) % 100) / 100 * H + g.alt * 6) % H;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }

    // ---- generate upward forever ----
    while (g.rungs[g.rungs.length - 1].alt < g.alt + SPAN) {
      g.top++; g.rungs.push(makeRung(g.top));
    }
    if (g.rungs.length > 120) g.rungs.splice(0, g.rungs.length - 120);

    // ---- landing: only while falling, only onto a rung at the player's feet ----
    if (armedRef.current && g.vy < 0) {
      for (const r of g.rungs) {
        if (Math.abs(g.alt - r.alt) < .16 && g.x > r.x && g.x < r.x + r.w) {
          g.alt = r.alt; g.vy = .062;              // bounce upward
          g.standing = r.i;
          if (!r.got) {
            r.got = 1;
            if (r.kind === "hazard") { onBust(); banner("CREVASSE", "#ff6b35"); }
            else if (r.kind === "summit") {
              g.summits++;
              onScore(12 + g.summits * 5);
              banner("SUMMIT " + g.summits, "#6fffb0");
            } else if (r.kind === "sat") onScore(4);
            else onScore(1);
          }
          break;
        }
      }
    }

    // ---- altitude itself pays, every 10 units ----
    if (g.alt > g.best) {
      const gained = Math.floor(g.alt / 10) - Math.floor(g.best / 10);
      if (gained > 0) onScore(gained * 3);
      g.best = g.alt;
    }
    // falling off the bottom of the world
    if (armedRef.current && g.alt <= 0 && g.vy <= 0 && g.best > 2) {
      onBust(); banner("FELL", "#ff6b35"); g.vy = .05;
    }

    // ---- draw rungs ----
    for (const r of g.rungs) {
      const y = altToY(r.alt);
      if (y < -30 || y > H + 30) continue;
      const col = r.kind === "hazard" ? "#ff6b35" : r.kind === "sat" ? "#ffd24a"
                : r.kind === "summit" ? "#6fffb0" : r.kind === "ground" ? "#2a3c70" : "#8effff";
      const RH = px(U * .032, 4);
      const lg = ctx.createLinearGradient(r.x * W, y, r.x * W, y + RH);
      lg.addColorStop(0, r.got ? "rgba(255,255,255,.35)" : "#ffffff");
      lg.addColorStop(.4, r.got ? "rgba(93,246,255,.25)" : col);
      lg.addColorStop(1, "rgba(0,0,0,.5)");
      ctx.fillStyle = lg;
      ctx.shadowBlur = r.got ? 0 : 12; ctx.shadowColor = col;
      ctx.fillRect(r.x * W, y, r.w * W, RH);
      ctx.shadowBlur = 0;
      if (!r.got && r.kind !== "ice" && r.kind !== "ground") {
        ctx.fillStyle = col; ctx.font = `${px(U * .06, 8)}px VT323`; ctx.textAlign = "center";
        ctx.shadowBlur = 8; ctx.shadowColor = col;
        ctx.fillText(r.kind === "hazard" ? "☠" : r.kind === "summit" ? "▲" : "◆",
                     (r.x + r.w / 2) * W, y - 2);
        ctx.shadowBlur = 0;
      }
    }

    // ---- the climber ----
    const py = altToY(g.alt);
    ctx.save();
    ctx.translate(g.x * W, py);
    const bodyH = px(U * .085, 11), bodyW = px(U * .062, 8);
    const bg2 = ctx.createLinearGradient(-bodyW / 2, -bodyH, bodyW / 2, 0);
    bg2.addColorStop(0, "#ffffff"); bg2.addColorStop(1, "#8effff");
    ctx.fillStyle = bg2;
    ctx.shadowBlur = 16; ctx.shadowColor = "#5df6ff";
    ctx.fillRect(-bodyW / 2, -bodyH, bodyW, bodyH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff2d9d"; ctx.fillRect(-bodyW / 2, -bodyH * .28, bodyW, Math.max(2, bodyH * .18));
    ctx.fillStyle = "#0b1226";
    ctx.fillRect(-bodyW * .3, -bodyH * .82, Math.max(1.5, bodyW * .18), Math.max(1.5, bodyH * .16));
    ctx.fillRect(bodyW * .12, -bodyH * .82, Math.max(1.5, bodyW * .18), Math.max(1.5, bodyH * .16));
    ctx.restore();

    // ---- HUD: altitude is the score ----
    ctx.textAlign = "right";
    const altText = Math.floor(g.alt * 10) + "m";
    const altF = px(U * .09, 11);
    ctx.fillStyle = "#eaffff"; ctx.font = `${altF}px VT323`;
    ctx.shadowBlur = 12; ctx.shadowColor = "#5df6ff";
    ctx.fillText(altText, W - 6, altF);
    ctx.shadowBlur = 0;
    if (g.summits > 0) {
      ctx.fillStyle = "#6fffb0"; ctx.font = `${px(U * .062, 8)}px VT323`;
      ctx.fillText("▲" + g.summits, W - 6, altF * 1.95);
    }
    // an up arrow, so the direction of travel is never in doubt
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(111,255,176,.8)"; ctx.font = `${px(U * .07, 9)}px VT323`;
    ctx.fillText("▲ UP", 6, altF);

    if (g.banner) {
      g.banner.life -= dt * .014;
      if (g.banner.life <= 0) g.banner = null;
      else {
        ctx.textAlign = "center"; ctx.globalAlpha = clamp(g.banner.life, 0, 1);
        ctx.fillStyle = g.banner.color; ctx.font = `${px(U * .07, 8)}px "Press Start 2P", monospace`;
        ctx.shadowBlur = 20; ctx.shadowColor = g.banner.color;
        ctx.fillText(g.banner.text, W / 2, H * .34);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
  }, live && !revealed && !run.busted);

  function steer(e) {
    if (!live || revealed || run.busted) return;
    if (!armedRef.current) { armedRef.current = true; setArmed(true); G.current.vy = .062; }
    const r = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX ?? (e.touches && e.touches[0].clientX);
    if (cx == null) return;
    const target = (cx - r.left) / r.width;
    G.current.vx = (target - G.current.x) * .09;
  }
  useEffect(() => {
    if (!live) return;
    function k(e) {
      const L = e.key === "ArrowLeft" || e.key === "a", R2 = e.key === "ArrowRight" || e.key === "d";
      if (!L && !R2) return;
      e.preventDefault();
      if (!armedRef.current) { armedRef.current = true; setArmed(true); G.current.vy = .062; }
      G.current.vx = L ? -.022 : .022;
    }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [live]);

  return (
    <Shell run={run} live={live} revealed={revealed} color="#8effff" armed={armed}
           label="ALTITUDE" hint="TAP A SIDE OR A/D · CLIMB TO THE SUMMIT ▲">
      <canvas ref={ref} className="gp-canvas" onClick={steer} onTouchStart={steer}
              onMouseMove={(e) => e.buttons && steer(e)}/>
    </Shell>
  );
}

// =====================================================
// 8. HASH RUNNER — endless dash, jump the blocks, grab the sats
// =====================================================
function HashRunner({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const [armed, setArmed] = useState(false);
  const [tip, setTip] = useState(null);
  const [lives, setLives] = useState(3);
  const armedRef = useRef(false), livesRef = useRef(3);
  livesRef.current = lives;
  const G = useRef({ y: .8, vy: 0, grounded: true, obs: [], t: 0, dist: 0, band: -1, since: 0, coyote: 0 });

  function say(m, ms) { setTip(m); setTimeout(() => setTip(null), ms || 3000); }

  // BANDS: speed and spacing are tuned so a jump is always physically makeable.
  // gap = minimum distance between obstacles, in the same units as x.
  const BANDS = [
    { at: 0,   spd: .0042, gap: .62, dbl: 0,   sat: .30, tip: "TAP OR SPACE TO JUMP · TAKE YOUR TIME" },
    { at: 90,  spd: .0050, gap: .55, dbl: 0,   sat: .32, tip: "◆ SATS FLOAT AT JUMP HEIGHT · GRAB THEM MID-AIR" },
    { at: 220, spd: .0058, gap: .50, dbl: .12, sat: .32, tip: "TALLER BLOCKS NOW · JUMP A BEAT EARLIER" },
    { at: 400, spd: .0066, gap: .46, dbl: .22, sat: .34, tip: "PAIRS INCOMING · ONE JUMP CLEARS BOTH" },
    { at: 620, spd: .0074, gap: .43, dbl: .30, sat: .36, tip: "FULL SPEED · THE RHYTHM IS THE GAME" },
  ];
  function bandFor(d) { return BANDS.reduce((a, x, i) => d >= x.at ? i : a, 0); }

  const JUMP_V = -.0295, GRAV = .00092, GROUND = .8;

  useLoop((dt) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, g = G.current;
    const U = unit(W, H);
    const go = armedRef.current;
    g.t += dt;

    const bandIx = bandFor(g.dist);
    const B = BANDS[bandIx];
    if (go && bandIx !== g.band) { g.band = bandIx; say(B.tip, 3400); }

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(93,246,255,.1)"; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = W - ((g.t * 1.6 + i * W / 8) % (W + 60));
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.fillStyle = "rgba(46,107,255,.28)"; ctx.fillRect(0, H * .84, W, H * .16);
    ctx.strokeStyle = "#5df6ff"; ctx.beginPath(); ctx.moveTo(0, H * .84); ctx.lineTo(W, H * .84); ctx.stroke();

    if (go) {
      g.dist += B.spd * dt * 60;
      g.since += B.spd * dt;
      // spawn only when the last obstacle is far enough away to be jumpable
      const lastX = g.obs.length ? Math.max(...g.obs.map((o) => o.x)) : -9;
      if (g.since > B.gap && lastX < 1.02 - B.gap) {
        g.since = 0;
        if (Math.random() < B.sat) {
          g.obs.push({ x: 1.06, kind: "sat", hit: 0 });
        } else {
          const tall = Math.random() < B.dbl;
          g.obs.push({ x: 1.06, kind: "block", h: tall ? .085 : .055, hit: 0 });
        }
      }

      g.vy += GRAV * dt;
      g.y = Math.min(GROUND, g.y + g.vy * dt);
      if (g.y >= GROUND) { g.y = GROUND; g.vy = 0; g.grounded = true; g.coyote = 8; }
      else { g.grounded = false; g.coyote = Math.max(0, g.coyote - dt); }
    }

    const PX = .18, PR = .026;
    for (const o of g.obs) {
      if (go) o.x -= B.spd * dt * .62;
      const ox = o.x * W;
      const oy = o.kind === "block" ? H * .84 - o.h * H : H * .655;
      if (!o.hit) {
        const col = o.kind === "sat" ? "#ffd24a" : "#ff2d9d";
        ctx.fillStyle = col; ctx.shadowBlur = 12; ctx.shadowColor = col;
        if (o.kind === "sat") { ctx.beginPath(); ctx.arc(ox, oy, W * .019, 0, 7); ctx.fill(); }
        else ctx.fillRect(ox, oy, W * .042, o.h * H);
        ctx.shadowBlur = 0;
      }
      if (!go || o.hit) continue;
      if (o.kind === "sat") {
        // generous pickup: anywhere near jump apex
        if (Math.abs(o.x - PX) < PR + .03 && g.y < GROUND - .04) { o.hit = 1; onScore(3); }
      } else {
        const clears = g.y < GROUND - o.h - .012;
        if (Math.abs(o.x - PX) < PR + .022 && !clears) {
          o.hit = 1;
          const l = livesRef.current - 1;
          livesRef.current = l; setLives(l);
          if (l <= 0) { onBust(); say("OUT OF STUMBLES · BOARD LOST", 4000); }
          else { say("STUMBLE · " + l + " LEFT", 2000); g.vy = JUMP_V * .5; }
        }
      }
    }
    g.obs = g.obs.filter((o) => o.x > -.12);

    const py = g.y * H;
    ctx.fillStyle = "#fff"; ctx.shadowBlur = 14; ctx.shadowColor = "#5df6ff";
    ctx.fillRect(PX * W - W * .021, py - H * .058, W * .042, H * .058);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#6fffb0"; ctx.fillRect(PX * W - W * .021, py - H * .021, W * .042, H * .011);
    ctx.fillStyle = "rgba(93,246,255,.75)"; ctx.font = `${W * .05}px VT323`; ctx.textAlign = "right";
    ctx.fillText(Math.floor(g.dist) + "m", W - 8, H * .09);
  }, live && !revealed && !run.busted);

  const jump = useCallback(() => {
    if (!live || revealed || run.busted) return;
    const g = G.current;
    if (!armedRef.current) { armedRef.current = true; setArmed(true); say(BANDS[0].tip, 3400); return; }
    // coyote time — a jump pressed just after leaving the ground still counts
    if (g.grounded || g.coyote > 0) { g.vy = JUMP_V; g.grounded = false; g.coyote = 0; }
  }, [live, revealed, run.busted]);

  useEffect(() => {
    if (!live) return;
    function k(e) { if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); jump(); } }
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [jump, live]);

  return (
    <Shell run={run} live={live} revealed={revealed} color="#ff6b35" armed={armed}
           tip={tip} lives={armed ? lives : null}
           label="METRES" hint="TAP / SPACE TO START RUNNING">
      <canvas ref={ref} className="gp-canvas" onClick={jump} onTouchStart={jump}/>
    </Shell>
  );
}

// =====================================================
// 9. CRYO STACK — drop the blocks, build the tallest stable tower
// =====================================================
function CryoStack({ state, run, onScore, onBust, live, revealed }) {
  const ref = useRef(null); useFitCanvas(ref);
  const G = useRef({ stack: [], cur: null, dir: 1, x: .1, t: 0 });
  useLoop((dt) => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, g = G.current;
    const U = unit(W, H);
    g.t += dt;
    ctx.clearRect(0, 0, W, H);
    const bh = Math.max(7, H * .06);
    if (!g.cur) g.cur = { w: .42 - g.stack.length * .012, x: .1 };
    g.cur.w = Math.max(.12, g.cur.w);
    g.x += g.dir * .009 * dt;
    if (g.x + g.cur.w > .97) { g.x = .97 - g.cur.w; g.dir = -1; }
    if (g.x < .03) { g.x = .03; g.dir = 1; }
    // stack
    g.stack.forEach((b, i) => {
      const y = H - (i + 1) * bh;
      const hue = 190 + i * 9;
      ctx.fillStyle = `hsl(${hue} 90% 62%)`;
      ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(b.x * W, y, b.w * W, bh - 3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(b.x * W, y, b.w * W, 3);
    });
    // moving block
    const cy = H - (g.stack.length + 1) * bh;
    ctx.fillStyle = "#ffd24a"; ctx.shadowBlur = 14; ctx.shadowColor = "#ffd24a";
    ctx.fillRect(g.x * W, cy, g.cur.w * W, bh - 3); ctx.shadowBlur = 0;
    // guide
    if (g.stack.length) {
      const t = g.stack[g.stack.length - 1];
      ctx.strokeStyle = "rgba(111,255,176,.5)"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(t.x * W, 0); ctx.lineTo(t.x * W, H);
      ctx.moveTo((t.x + t.w) * W, 0); ctx.lineTo((t.x + t.w) * W, H); ctx.stroke();
      ctx.setLineDash([]);
    }
    const sf = px(U * .07, 9);
    ctx.fillStyle = "rgba(93,246,255,.75)"; ctx.font = `${sf}px VT323`; ctx.textAlign = "left";
    ctx.fillText("H " + g.stack.length, 6, sf);
  }, live && !revealed && !run.busted);
  function drop() {
    if (!live || revealed || run.busted) return;
    const g = G.current;
    if (!g.cur) return;
    const prev = g.stack[g.stack.length - 1];
    if (prev) {
      const wide = g.cur.w;
      const l = Math.max(prev.x, g.x), r = Math.min(prev.x + prev.w, g.x + wide);
      const ov = r - l;
      if (ov <= .02) { onBust(); return; }
      g.stack.push({ x: l, w: ov });
      g.cur = { w: ov, x: g.x };
      onScore(ov > wide * .88 ? 4 : 2);
    } else {
      g.stack.push({ x: g.x, w: g.cur.w });
      g.cur = { w: g.cur.w, x: g.x };
      onScore(2);
    }
    if (g.stack.length >= 12) onScore(15);
  }
  return (
    <Shell run={run} live={live} revealed={revealed} color="#ffd24a"
           label="HEIGHT" hint="TAP TO DROP · KEEP IT ALIGNED">
      <canvas ref={ref} className="gp-canvas" onClick={drop} onTouchStart={drop}/>
    </Shell>
  );
}

// =====================================================
// REGISTRY — nine genuinely different cabinets
// =====================================================
function mk(seed, n, total) {
  let s = seed >>> 0 || 3;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = new Set();
  while (out.size < Math.min(n, total)) out.add(Math.floor(r() * total));
  return [...out];
}

const GAMES9 = {
  sats: {
    key: "sats", name: "RELEASE THE SATS", short: "SATS", color: "#ffd24a", cells: 7,
    blurb: "drop sats through the pegs · miss the trap pits",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="8" y="2" width="8" height="5" rx="1"/><circle cx="12" cy="11" r="1.6"/><circle cx="8" cy="15" r="1.4"/><circle cx="16" cy="15" r="1.4"/><rect x="3" y="19" width="5" height="4"/><rect x="10" y="19" width="4" height="4"/><rect x="16" y="19" width="5" height="4"/></svg>,
    generate: (seed) => {
      const traps = mk(seed, 2, 7);
      return { pits: Array.from({ length: 7 }, (_, i) => traps.includes(i) ? 1 : 0), mines: traps };
    },
    Play: ReleaseTheSats,
  },
  maze: {
    key: "maze", name: "SOLVE THE MAZE", short: "MAZE", color: "#a280ff", cells: 81,
    blurb: "generative maze · reach the exit before the block",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3h18v18H3z"/><path d="M3 9h6M9 3v6M15 9V3M15 9h6M9 15H3M9 15v6M15 15h6M15 15v6M9 12h6"/></svg>,
    generate: (seed) => ({ maze: genMaze(seed), mines: [] }),
    Play: SolveTheMaze,
  },
  buster: {
    key: "buster", name: "BLOCK BUSTER", short: "BUST", color: "#6fffb0", cells: 36,
    blurb: "slide rows and columns · forge the longest chain",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="2" y="2" width="6" height="6"/><rect x="9" y="2" width="6" height="6" opacity=".5"/><rect x="16" y="2" width="6" height="6"/><rect x="2" y="9" width="6" height="6" opacity=".5"/><rect x="9" y="9" width="6" height="6"/><rect x="16" y="9" width="6" height="6" opacity=".5"/><rect x="2" y="16" width="6" height="6"/><rect x="9" y="16" width="6" height="6" opacity=".5"/><rect x="16" y="16" width="6" height="6"/></svg>,
    generate: (seed) => {
      let s = seed >>> 0 || 5;
      const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      return { grid: Array.from({ length: 36 }, () => Math.floor(r() * 5)), mines: [] };
    },
    Play: BlockBuster,
  },
  zapper: {
    key: "zapper", name: "ZAPPER", short: "ZAP", color: "#ff2d9d", cells: 14,
    blurb: "first-person laser · collect fire, crack glaciers",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="7"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
    generate: (seed) => ({ mines: mk(seed, 3, 14) }),
    Play: Zapper,
  },
  breaker: {
    key: "breaker", name: "ICE BREAKER", short: "BRK", color: "#8effff", cells: 28,
    blurb: "paddle and ball · smash the wall, keep the sat alive",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="2" y="3" width="6" height="3"/><rect x="9" y="3" width="6" height="3"/><rect x="16" y="3" width="6" height="3"/><rect x="2" y="7" width="6" height="3" opacity=".6"/><rect x="9" y="7" width="6" height="3" opacity=".6"/><rect x="16" y="7" width="6" height="3" opacity=".6"/><circle cx="12" cy="15" r="2"/><rect x="7" y="20" width="10" height="2.5" rx="1"/></svg>,
    generate: (seed) => ({ mines: mk(seed, 4, 28) }),
    Play: IceBreaker,
  },
  snake: {
    key: "snake", name: "SAT SNAKE", short: "SNKE", color: "#6fffb0", cells: 144,
    blurb: "grow the chain · dodge your tail and the mines",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"><path d="M3 6h8v6H6v6h12"/><circle cx="19" cy="6" r="2" fill="currentColor" stroke="none"/></svg>,
    generate: (seed) => {
      const flat = mk(seed, 7, 144);
      // keep the entire starting row clear, plus one row either side — the snake
      // opens moving right and must have room to react before the first hazard.
      const safe = ([x, y]) => !(Math.abs(y - 6) <= 1);
      const cells = flat.map((i) => [i % 12, (i / 12) | 0]).filter(safe);
      return { snakeMines: cells, mines: flat };
    },
    Play: SatSnake,
  },
  climb: {
    key: "climb", name: "GLACIER CLIMB", short: "CLMB", color: "#5df6ff", cells: 26,
    blurb: "hop the ledges · altitude is the payout",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="20" width="8" height="2"/><rect x="12" y="16" width="8" height="2"/><rect x="2" y="12" width="8" height="2"/><rect x="13" y="8" width="8" height="2"/><rect x="5" y="4" width="8" height="2"/><circle cx="7" cy="2" r="1.6"/></svg>,
    generate: (seed) => ({ mines: mk(seed, 4, 26) }),
    Play: GlacierClimb,
  },
  runner: {
    key: "runner", name: "HASH RUNNER", short: "RUN", color: "#ff6b35", cells: 20,
    blurb: "endless dash · jump the blocks, grab the sats",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="14" cy="4" r="2.2"/><path d="M13 7l-3 5 2 4-1 4h2l2-5-2-3 3-2 3 3 1-2-4-4z"/><rect x="2" y="20" width="20" height="2"/></svg>,
    generate: (seed) => ({ mines: mk(seed, 3, 20) }),
    Play: HashRunner,
  },
  stack: {
    key: "stack", name: "CRYO STACK", short: "STCK", color: "#ffd24a", cells: 12,
    blurb: "drop and align · the tower is the multiplier",
    Icon: () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="4" y="19" width="16" height="3"/><rect x="6" y="15" width="12" height="3"/><rect x="7" y="11" width="10" height="3"/><rect x="9" y="7" width="7" height="3"/><rect x="10" y="3" width="5" height="3" opacity=".6"/></svg>,
    generate: (seed) => ({ mines: mk(seed, 2, 12) }),
    Play: CryoStack,
  },
};
const GAME9_KEYS = ["sats", "maze", "buster", "zapper", "breaker", "snake", "climb", "runner", "stack"];

Object.assign(window, { GAMES9, GAME9_KEYS, SatSnake, GlacierClimb, HashRunner, CryoStack });
})();
