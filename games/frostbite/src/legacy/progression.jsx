// FROST-BITE :: progression — diesel mining, icicles, glaciers, badges, levels, block budget
(function () {
const { useState, useEffect, useRef } = React;

// ---------------- MODES ----------------
const MODES = {
  diesel: { key: "diesel", label: "DIESEL", blocks: 69, cool: 69, cooldownName: "TOUCH GRASS",
           mineMult: 1, payMult: 1, body: "dieselmode", color: "#ff6b35",
           blurb: "the core loop · 69 blocks, then you go outside · every tx mines" },
  agent: { key: "agent", label: "AGENT", blocks: 42, cool: 42, cooldownName: "REINDEX",
           mineMult: 1, payMult: 1, body: null, color: "#a280ff",
           blurb: "42 blocks · rate-limited by design" },
  dog:   { key: "dog",   label: "$DOG",  blocks: 21, cool: 21, cooldownName: "SQUIRREL",
           mineMult: 2, payMult: 1.5, body: "dogmode", color: "#ffd24a",
           blurb: "21 blocks · double mines · double treats · zero impulse control" },
  fire:  { key: "fire",  label: "FIRE",  blocks: 33, cool: 33, cooldownName: "BURNOUT",
           mineMult: 1.6, payMult: 2.2, body: "firemode", color: "#ff6b35",
           blurb: "33 blocks · more mines, far bigger pots · the greedy lane" },
  air:   { key: "air",   label: "AIR",   blocks: 88, cool: 11, cooldownName: "DRIFT",
           mineMult: 0.55, payMult: 0.75, body: "airmode", color: "#c8f0ff",
           blurb: "88 blocks, 11-block rest · few mines, gentle pots · the long game" },
  cheese:{ key: "cheese",label: "CHEESE",blocks: 27, cool: 27, cooldownName: "LACTOSE PAUSE",
           mineMult: "chaos", payMult: 1.4, body: "cheesemode", color: "#ffe066",
           blurb: "27 blocks · mine count randomised per board · nobody knows why" },
};
const MODE_KEYS = ["diesel", "agent", "dog", "fire", "air", "cheese"];

// ~10 min per block, phrased loosely because block times vary
function hoursFor(blocks) {
  const mins = blocks * 10;
  if (mins < 90) return mins + " minutes";
  const h = mins / 60;
  return (h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)) + " hours";
}
function blocksPhrase(n) { return n + " block" + (n === 1 ? "" : "s"); }

const COOLDOWNS = {
  diesel: { title: "✳ TOUCH GRASS ✳", color: "#7ee88f", cast: "grass",
            bg: "radial-gradient(ellipse at 50% 120%,rgba(60,180,90,.35),rgba(4,6,13,.96) 60%)",
            sub: (b, c) => `You played ${b} block${b === 1 ? "" : "s"} straight — about ${hoursFor(b)} of Bitcoin. Frost·Bite is now closed to you for ${c} — lovingly, deliberately.` },
  agent:  { title: "◆ REINDEXING ◆", color: "#a280ff", cast: "cat",
            bg: "radial-gradient(ellipse at 50% 120%,rgba(106,77,255,.3),rgba(4,6,13,.96) 60%)",
            sub: (b, c) => `Agent sessions cap at ${b} blocks, then rest ${c}. The protocol is rate-limiting you on purpose — an unbounded agent is just a very fast way to lose money.` },
  dog:    { title: "◉ SQUIRREL!! ◉", color: "#ffd24a", cast: "dogs",
            bg: "radial-gradient(ellipse at 50% 60%,rgba(255,150,40,.28),rgba(11,6,2,.97) 62%)",
            sub: (b, c) => `${b} blocks in, the entire $DOG ARMY broke formation to pursue a squirrel through the mempool. Nobody is guarding the boards for ${c}. This was always going to happen.` },
  fire:   { title: "▲ BURNOUT ▲", color: "#ff6b35", cast: "fire",
            bg: "radial-gradient(ellipse at 50% 110%,rgba(255,90,30,.4),rgba(13,4,2,.97) 62%)",
            sub: (b, c) => `You ran the rigs at 2.2× for ${b} blocks and the seals are glowing. Danni pulled the pressure valve — ${c} to cool, or lose the rig.` },
  air:    { title: "≈ DRIFT ≈", color: "#c8f0ff", cast: "air",
            bg: "radial-gradient(ellipse at 50% 20%,rgba(180,230,255,.3),rgba(8,20,32,.97) 64%)",
            sub: (b, c) => `${b} blocks of light work. Air rests briefly and often — ${c} and you are back in the sky. Breathe.` },
  cheese: { title: "● LACTOSE PAUSE ●", color: "#ffe066", cast: "cheese",
            bg: "radial-gradient(ellipse at 50% 90%,rgba(255,210,74,.3),rgba(15,11,3,.97) 62%)",
            sub: (b, c) => `${b} blocks, then the wheel rolled off the table and the mice followed it. Cheese was never explained and will not be defended. ${c}.` },
};

// ---------------- GLACIER TIERS ----------------
const TIERS = [
  { id: 1, name: "ICE SHELF",  cost: 300,  mult: 3, color: "#5df6ff",
    perk: "3× icicle→GLACIER conversion · 1 badge slot" },
  { id: 2, name: "BERG",       cost: 1200, mult: 6, color: "#6fffb0",
    perk: "6× conversion · diesel pot share ×1.5 · 2 badge slots" },
  { id: 3, name: "TITAN SHELF",cost: 4200, mult: 9, color: "#a280ff",
    perk: "9× conversion · diesel pot share ×2 · orbital glacier mint" },
];

// ---------------- BADGES ----------------
const BADGES = [
  { id: "firstblood", name: "FIRST DEFROST",   hint: "win your first board",              ic: "❄" },
  { id: "sweep",      name: "CLEAN SWEEP",     hint: "win all 4 boards in one round",     ic: "◆" },
  { id: "diesel100",  name: "GREASE MONKEY",   hint: "mine 100 diesel",                   ic: "✦" },
  { id: "kots",       name: "SAT MONARCH",     hint: "win King of the SAT",               ic: "♛" },
  { id: "subzero",    name: "CORE BREAKER",    hint: "solve the Subzero Core",            ic: "◉" },
  { id: "shelf",      name: "SHELF BUILDER",   hint: "erect an Ice Shelf",                ic: "▲" },
  { id: "titan",      name: "TITAN",           hint: "erect a Titan Shelf",               ic: "⬟" },
  { id: "dogarmy",    name: "PACK LEADER",     hint: "field 21 $DOG troops",              ic: "⬢" },
  { id: "fetch",      name: "GOOD BOY",        hint: "fetch 10 bones in dog mode",        ic: "▬" },
  { id: "grass",      name: "TOUCHED GRASS",   hint: "complete a human cooldown",         ic: "✽" },
  { id: "cashout",    name: "GLACIAL EXIT",    hint: "cash out to GLACIER tokens",        ic: "◇" },
  { id: "wizard",     name: "WIZARD'S NOD",    hint: "reach level 9",                     ic: "✧" },
];

const XP_PER_LEVEL = 220;

// ---------------- DIESEL RAIL ----------------
function DieselRail({ diesel, txCount, striking, mode }) {
  const capForBar = 50;
  return (
    <div className={"diesel-rail" + (striking ? " striking" : "")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <DieselMiner size={42} striking={striking} />
      </div>
      <div>
        <div className="dz-track"><i style={{ width: Math.min(100, ((diesel % capForBar) / capForBar) * 100) + "%" }} /></div>
        <div className="dz-meta">
          <span>the house signs every tx · <b className="hot">every tx mines diesel</b></span>
          <span className="dim">{txCount} tx broadcast · {mode === "dog" ? "×2 dog rate" : "1.0× rate"}</span>
        </div>
      </div>
      <div className="dz-amount">{diesel.toFixed(4)} <b>DIESEL</b></div>
    </div>
  );
}

// ---------------- BLOCK BUDGET + MODE SWITCH ----------------
function BlockBudget({ mode, onMode, used, cooling, max, coolMax }) {
  const m = MODES[mode];
  const cap = max || m.blocks;
  const left = Math.max(0, cap - used);
  const pct = (left / cap) * 100;
  return (
    <div className="budget">
      <div className="mode-pill">
        {MODE_KEYS.map((k) => (
          <button key={k} className={k} data-on={mode === k ? "1" : undefined}
                  onClick={() => onMode(k)} title={MODES[k].blurb}>
            {MODES[k].label}
          </button>
        ))}
      </div>
      <div>
        <div className={"budget-bar" + (pct < 25 ? " warn" : "")}>
          <i style={{ width: pct + "%" }} />
        </div>
        <div style={{ fontFamily: "var(--f-term)", fontSize: 12, color: "var(--silver)", marginTop: 3 }}>
          {cooling ? <span className="hot">cooling down · {m.cooldownName.toLowerCase()}</span>
                   : <><b className="frost">{left}</b> / {cap} blocks left</>}
        </div>
      </div>
    </div>
  );
}

// ---------------- TOUCH GRASS / cooldown ----------------
function ModeCooldown({ remaining, total, mode, played }) {
  const c = COOLDOWNS[mode] || COOLDOWNS.diesel;
  const done = total ? (total - remaining) / total : 0;
  // the sentence is derived, never asserted — total and played are the shipped values
  const budget = played != null ? played : (MODES[mode] || MODES.diesel).blocks;
  const subText = typeof c.sub === "function" ? c.sub(budget, blocksPhrase(total)) : c.sub;
  return (
    <div className="cool-veil" style={{ background: c.bg }}>
      <div className="grass-card">
        <div className="cool-title" style={{ color: c.color }}>{c.title}</div>
        <div className="cool-sub">{subText}</div>

        <div className="cool-cast">
          {c.cast === "grass" && (
            <div className="grass-strip" style={{ marginTop: 0 }}>
              {Array.from({ length: 34 }, (_, i) => (
                <span key={i} className="blade"
                      style={{ height: 30 + ((i * 37) % 50), animationDelay: (i % 7) * 0.18 + "s" }}/>
              ))}
            </div>
          )}
          {c.cast === "cat" && <QuantumCat size={76}/>}
          {c.cast === "dogs" && [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="dog-troop" style={{ animationDelay: i * 0.08 + "s" }}>
              <DogSoldier size={48} rank={i === 4 ? 2 : 0} barking/>
            </div>
          ))}
          {c.cast === "fire" && (
            <>
              <LtDanniDiesel size={76}/>
              <DieselMiner size={62} striking/>
            </>
          )}
          {c.cast === "air" && (
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
              <div style={{ animation: "airFloat 3.4s ease-in-out infinite" }}><QuantumCat size={62}/></div>
              <div style={{ animation: "airFloat 3.4s ease-in-out .9s infinite" }}><FrostWizard size={70}/></div>
            </div>
          )}
          {c.cast === "cheese" && (
            <>
              <svg viewBox="0 0 40 40" width="74" height="74" shapeRendering="crispEdges"
                   style={{ animation: "crumbFall 0s", transform: "rotate(-8deg)" }}>
                <polygon points="4,32 36,32 36,14 4,22" fill="#ffe066"/>
                <polygon points="4,22 36,14 36,10 4,18" fill="#fff3b0"/>
                <polygon points="4,32 4,22 4,18" fill="#d9a520"/>
                <circle cx="13" cy="27" r="3" fill="#c98f20"/>
                <circle cx="24" cy="24" r="2.2" fill="#c98f20"/>
                <circle cx="31" cy="27" r="1.6" fill="#c98f20"/>
              </svg>
              <DogSoldier size={58} barking/>
            </>
          )}
        </div>

        <div className="cool-count" style={{ color: c.color }}>
          {remaining}
          <small>BLOCKS UNTIL RESUME · {total} BLOCK COOLDOWN</small>
        </div>
        <div className="cool-bar" style={{ color: c.color }}>
          <i style={{ width: (done * 100).toFixed(1) + "%", background: c.color }}/>
        </div>
      </div>
    </div>
  );
}

// back-compat wrappers
function TouchGrass(p) { return <ModeCooldown {...p}/>; }
function HumanGrass(p) { return <ModeCooldown {...p} mode="diesel"/>; }

// ---------------- GLACIER BUILDER ----------------
function GlacierIce({ tier, size = 34 }) {
  const t = TIERS[tier - 1] || TIERS[0];
  const h = [12, 20, 28][tier - 1] || 12;
  return (
    <svg viewBox="0 0 34 34" width={size} height={size} shapeRendering="crispEdges">
      <polygon points={`17,${34 - h - 6} 30,34 4,34`} fill={t.color} opacity="0.85"/>
      <polygon points={`17,${34 - h - 6} 24,34 10,34`} fill="#fff" opacity="0.28"/>
      {tier > 1 && <polygon points={`8,${34 - h + 2} 16,34 1,34`} fill={t.color} opacity="0.6"/>}
      {tier > 2 && <polygon points={`26,${34 - h + 4} 33,34 19,34`} fill={t.color} opacity="0.6"/>}
      <rect x="0" y="32" width="34" height="2" fill={t.color} opacity="0.35"/>
    </svg>
  );
}

function GlacierBuilder({ icicles, built, onBuild }) {
  return (
    <div className="tiers">
      {TIERS.map((t) => {
        const isBuilt = built >= t.id;
        const canAfford = icicles >= t.cost;
        const isNext = built === t.id - 1;
        const locked = !isBuilt && (!isNext || !canAfford);
        return (
          <div key={t.id} className="tier"
               data-built={isBuilt ? "1" : undefined}
               data-locked={locked ? "1" : undefined}
               onClick={() => !locked && !isBuilt && onBuild(t.id)}>
            <div className="tier-ice"><GlacierIce tier={t.id}/></div>
            <div>
              <div className="tier-name" style={{ color: isBuilt ? t.color : undefined }}>{t.name}</div>
              <div className="tier-cost">
                {isBuilt ? <span className="mint" style={{ color: "var(--mint)" }}>✓ erected · {t.perk}</span>
                         : <>{t.cost.toLocaleString()} icicles {!canAfford && isNext && <span className="hot">· need {(t.cost - icicles).toLocaleString()} more</span>}
                            {!isNext && !isBuilt && <span className="dimmer"> · build {TIERS[t.id - 2]?.name} first</span>}</>}
              </div>
            </div>
            <div className="tier-mult">{t.mult}×</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- BADGE CASE ----------------
function BadgeCase({ earned }) {
  return (
    <div className="badge-case">
      {BADGES.map((b) => (
        <div key={b.id} className="badge" data-earned={earned.includes(b.id) ? "1" : undefined}>
          <span style={{ fontSize: 20, filter: earned.includes(b.id) ? "drop-shadow(0 0 6px var(--gold))" : "" }}>{b.ic}</span>
          <span className="badge-tip">{earned.includes(b.id) ? b.name : b.hint}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- LEVEL BAR ----------------
function LevelBar({ xp }) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return (
    <div className="lvl">
      <div className="lvl-num">L{level}</div>
      <div>
        <div className="lvl-track"><i style={{ width: (into / XP_PER_LEVEL) * 100 + "%" }} /></div>
        <div style={{ fontFamily: "var(--f-term)", fontSize: 12, color: "var(--silver)", marginTop: 4 }}>
          {into} / {XP_PER_LEVEL} xp to L{level + 1}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}><FrostWizard size={30}/></div>
    </div>
  );
}

// ---------------- GENERATIVE ORBITAL GLACIER ----------------
function OrbitalGlacier({ seed = 1, size = 220, tier = 1 }) {
  let s = (seed >>> 0) || 7;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xFFFFFFFF;
  const cx = 100, cy = 100;
  const palettes = [
    ["#5df6ff", "#2e6bff", "#8effff"],
    ["#6fffb0", "#5df6ff", "#d0ffe8"],
    ["#a280ff", "#ff2d9d", "#8effff"],
  ][tier - 1] || ["#5df6ff", "#2e6bff", "#8effff"];

  // central crystalline mass
  const shardCount = 5 + Math.floor(rnd() * 5) + tier * 2;
  const shards = Array.from({ length: shardCount }, () => {
    const a = rnd() * Math.PI * 2;
    const r = 16 + rnd() * 26;
    const w = 8 + rnd() * 16;
    const h = 22 + rnd() * 38;
    return { a, r, w, h, c: palettes[Math.floor(rnd() * palettes.length)], o: 0.5 + rnd() * 0.5 };
  });
  // orbital rings
  const ringCount = 1 + tier;
  const rings = Array.from({ length: ringCount }, (_, i) => ({
    rx: 58 + i * 15 + rnd() * 10,
    ry: (18 + rnd() * 16) * (1 + i * 0.2),
    rot: rnd() * 180,
    c: palettes[i % palettes.length],
    sat: 2 + Math.floor(rnd() * 4),
  }));

  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <radialGradient id={"gg" + seed}>
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9"/>
          <stop offset="55%" stopColor={palettes[0]} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={palettes[1]} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="72" fill={`url(#gg${seed})`}/>
      {/* orbits behind */}
      <g className="glacier-art">
        {rings.map((r, i) => (
          <g key={i} transform={`rotate(${r.rot} ${cx} ${cy})`}>
            <ellipse cx={cx} cy={cy} rx={r.rx} ry={r.ry} fill="none"
                     stroke={r.c} strokeWidth="0.7" opacity="0.5"/>
            {Array.from({ length: r.sat }, (_, k) => {
              const ang = (k / r.sat) * Math.PI * 2;
              const x = cx + r.rx * Math.cos(ang);
              const y = cy + r.ry * Math.sin(ang);
              const sz = 2.5 + (k % 3);
              return <polygon key={k}
                points={`${x},${y - sz} ${x + sz},${y} ${x},${y + sz} ${x - sz},${y}`}
                fill={r.c} opacity="0.9" style={{ filter: `drop-shadow(0 0 3px ${r.c})` }}/>;
            })}
          </g>
        ))}
      </g>
      {/* central mass */}
      <g>
        {shards.map((sh, i) => {
          const x = cx + sh.r * Math.cos(sh.a);
          const y = cy + sh.r * Math.sin(sh.a) * 0.6;
          const deg = (sh.a * 180) / Math.PI + 90;
          return (
            <polygon key={i}
              points={`${x},${y - sh.h / 2} ${x + sh.w / 2},${y + sh.h / 4} ${x},${y + sh.h / 2} ${x - sh.w / 2},${y + sh.h / 4}`}
              fill={sh.c} opacity={sh.o}
              transform={`rotate(${deg * 0.2} ${x} ${y})`}
              style={{ filter: `drop-shadow(0 0 4px ${sh.c})` }}/>
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={6 + tier * 2} fill="#fff" opacity="0.95"
              style={{ filter: `drop-shadow(0 0 12px ${palettes[0]})` }}/>
    </svg>
  );
}

Object.assign(window, {
  MODES, MODE_KEYS, COOLDOWNS, TIERS, BADGES, XP_PER_LEVEL,
  DieselRail, BlockBudget, ModeCooldown, TouchGrass, HumanGrass, hoursFor, blocksPhrase,
  GlacierBuilder, GlacierIce, BadgeCase, LevelBar, OrbitalGlacier,
});
})();
