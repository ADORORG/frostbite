// FROST-BITE :: KING OF THE SAT — free-for-all capture-the-flag, live while the block is unsolved
(function () {
const { useState, useEffect, useRef, useCallback } = React;

const N = 11;                    // arena is N×N
const TICK = 380;                // ms per rival move
const RIVALS = [
  { id: "r1", name: "QUANTUM CAT", color: "#a280ff", glyph: "🐈" },
  { id: "r2", name: "WIZ.SATS",    color: "#5df6ff", glyph: "🎩" },
  { id: "r3", name: "DOGE-9",      color: "#ffd24a", glyph: "🐕" },
  { id: "r4", name: "ORD_REAPER",  color: "#ff2d9d", glyph: "☠" },
  { id: "r5", name: "cold.storage",color: "#6fffb0", glyph: "❄" },
];

function key(x, y) { return y * N + x; }
function coords(i) { return [i % N, Math.floor(i / N)]; }
function dist(a, b) { const [ax, ay] = coords(a), [bx, by] = coords(b); return Math.abs(ax - bx) + Math.abs(ay - by); }

function buildArena(seed) {
  let s = (seed >>> 0) || 3;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xFFFFFFFF;
  const walls = new Set();
  // symmetric pillar pattern — readable, fair
  for (let i = 0; i < 14; i++) {
    const x = 1 + Math.floor(rnd() * (N - 2));
    const y = 1 + Math.floor(rnd() * (N - 2));
    if (x === 5 && y === 5) continue;
    walls.add(key(x, y));
    walls.add(key(N - 1 - x, N - 1 - y));
  }
  // central king zone
  const zone = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    zone.add(key(5 + dx, 5 + dy));
    walls.delete(key(5 + dx, 5 + dy));
  }
  return { walls, zone, rnd };
}

function KingOfTheSat({ height, blockProgress, onScore, onMine, onBadge, mode }) {
  const [arena] = useState(() => buildArena(height * 31 + 7));
  const [me, setMe] = useState(key(1, 1));
  const [rivals, setRivals] = useState(() =>
    RIVALS.map((r, i) => ({
      ...r,
      pos: [key(N - 2, 1), key(1, N - 2), key(N - 2, N - 2), key(5, 1), key(1, 5)][i],
      pts: 0, flags: 0, power: 0,
    }))
  );
  const [myPts, setMyPts] = useState(0);
  const [myFlags, setMyFlags] = useState(0);
  const [myPower, setMyPower] = useState(0);
  const [flags, setFlags] = useState(() => new Set([key(5, 5), key(2, 8), key(8, 2), key(9, 6)]));
  const [powers, setPowers] = useState(() => new Set([key(3, 3), key(7, 7)]));
  const [hitCell, setHitCell] = useState(null);
  const [feed, setFeed] = useState([{ t: "ARENA OPEN · block unsolved · all players hostile", c: "var(--frost)" }]);
  const [zoneTicks, setZoneTicks] = useState(0);

  const stateRef = useRef({});
  stateRef.current = { me, rivals, flags, powers, myPower, myPts };

  function say(t, c) {
    setFeed((f) => [{ t, c: c || "var(--silver)" }, ...f].slice(0, 9));
  }

  // ---- my move ----
  const moveMe = useCallback((target) => {
    const cur = stateRef.current.me;
    if (arena.walls.has(target)) return;
    const d = dist(cur, target);
    const reach = 1 + (stateRef.current.myPower > 0 ? 1 : 0);
    if (d === 0 || d > reach) return;
    setMe(target);
    onMine && onMine("kots-move");

    // pick up flag
    if (stateRef.current.flags.has(target)) {
      setFlags((f) => { const n = new Set(f); n.delete(target); return n; });
      setMyFlags((v) => v + 1);
      setMyPts((v) => v + 25);
      onScore && onScore(25);
      say("▸ you captured a FLAG · +25", "var(--gold)");
    }
    // pick up power
    if (stateRef.current.powers.has(target)) {
      setPowers((p) => { const n = new Set(p); n.delete(target); return n; });
      setMyPower((v) => v + 3);
      say("▸ POWER CORE · +3 charges · double step & steal", "var(--mint)");
    }
    // battle: any rival on this cell
    const foe = stateRef.current.rivals.find((r) => r.pos === target);
    if (foe) resolveBattle(foe, target);
  }, [arena]);

  function resolveBattle(foe, cell) {
    const iWin = stateRef.current.myPower > 0 || Math.random() > 0.45;
    setHitCell(cell);
    setTimeout(() => setHitCell(null), 420);
    if (iWin) {
      const stolen = foe.flags;
      setMyFlags((v) => v + stolen);
      setMyPts((v) => v + 40 + stolen * 15);
      onScore && onScore(40 + stolen * 15);
      setMyPower((v) => Math.max(0, v - 1));
      setRivals((rs) => rs.map((r) => r.id === foe.id
        ? { ...r, flags: 0, pts: Math.max(0, r.pts - 20), pos: [key(0,0),key(N-1,0),key(0,N-1),key(N-1,N-1)][Math.floor(Math.random()*4)] }
        : r));
      say(`▸ you knocked out ${foe.name} · stole ${stolen} flag${stolen !== 1 ? "s" : ""}`, "var(--mint)");
    } else {
      setMyFlags(0);
      setMyPts((v) => Math.max(0, v - 20));
      setMe(key(1, 1));
      say(`▸ ${foe.name} dropped you · flags lost · respawned`, "var(--hot)");
    }
  }

  // ---- rival AI tick ----
  useEffect(() => {
    const iv = setInterval(() => {
      const st = stateRef.current;
      setRivals((rs) => rs.map((r) => {
        // seek nearest flag, else drift to zone
        const targets = [...st.flags, ...st.powers];
        let goal = key(5, 5);
        let best = Infinity;
        for (const t of targets) {
          const d = dist(r.pos, t);
          if (d < best) { best = d; goal = t; }
        }
        const [rx, ry] = coords(r.pos);
        const [gx, gy] = coords(goal);
        const opts = [];
        if (gx > rx) opts.push(key(rx + 1, ry));
        if (gx < rx) opts.push(key(rx - 1, ry));
        if (gy > ry) opts.push(key(rx, ry + 1));
        if (gy < ry) opts.push(key(rx, ry - 1));
        opts.push(key(rx + (Math.random() > .5 ? 1 : -1), ry));
        const valid = opts.filter((o) => {
          const [ox, oy] = coords(o);
          return ox >= 0 && oy >= 0 && ox < N && oy < N && !arena.walls.has(o);
        });
        const next = valid.length ? valid[0] : r.pos;
        let pts = r.pts, fl = r.flags;
        if (st.flags.has(next)) { fl += 1; pts += 25; }
        if (arena.zone.has(next)) pts += 2;
        return { ...r, pos: next, pts, flags: fl };
      }));

      // rivals consume flags they land on
      setFlags((f) => {
        const n = new Set(f);
        for (const r of stateRef.current.rivals) n.delete(r.pos);
        return n;
      });

      // king zone scoring
      if (arena.zone.has(stateRef.current.me)) {
        setZoneTicks((z) => z + 1);
        setMyPts((v) => v + 3);
      }

      // spawn flags/powers
      if (Math.random() > 0.62) {
        setFlags((f) => {
          const n = new Set(f);
          for (let i = 0; i < 30; i++) {
            const c = Math.floor(Math.random() * N * N);
            if (!arena.walls.has(c) && !n.has(c)) { n.add(c); break; }
          }
          return n;
        });
      }
      if (Math.random() > 0.88) {
        setPowers((p) => {
          const n = new Set(p);
          for (let i = 0; i < 30; i++) {
            const c = Math.floor(Math.random() * N * N);
            if (!arena.walls.has(c) && !n.has(c)) { n.add(c); break; }
          }
          return n;
        });
      }
    }, TICK);
    return () => clearInterval(iv);
  }, [arena]);

  // keyboard
  useEffect(() => {
    function onKey(e) {
      const [x, y] = coords(stateRef.current.me);
      const map = { ArrowUp: [x, y - 1], ArrowDown: [x, y + 1], ArrowLeft: [x - 1, y], ArrowRight: [x + 1, y],
                    w: [x, y - 1], s: [x, y + 1], a: [x - 1, y], d: [x + 1, y] };
      const t = map[e.key];
      if (!t) return;
      e.preventDefault();
      const [tx, ty] = t;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) return;
      moveMe(key(tx, ty));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveMe]);

  const board = [...rivals.map((r) => ({ name: r.name, pts: r.pts, flags: r.flags, color: r.color, me: false })),
                 { name: "YOU", pts: myPts, flags: myFlags, color: "#5df6ff", me: true }]
                 .sort((a, b) => b.pts - a.pts);
  const leader = board[0];

  return (
    <div className="kots">
      <div>
        <div className="kots-hud">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SatKing size={40} color={leader.me ? "#5df6ff" : "#ffd24a"} />
            <div>
              <div className="fd" style={{ fontSize: 11, color: "var(--gold)" }}>KING OF THE SAT</div>
              <div className="ft dim" style={{ fontSize: 14 }}>
                free-for-all · live until block <b className="gold">#{(height + 1).toLocaleString()}</b> solves
              </div>
            </div>
          </div>
          <div className="pw-chips">
            <span className="pw-chip" style={{ color: "var(--gold)" }}>⚑ {myFlags}</span>
            <span className="pw-chip" style={{ color: "var(--mint)" }}>⚡ {myPower}</span>
            <span className="pw-chip" style={{ color: "var(--frost)" }}>◆ {myPts} PTS</span>
            <span className="pw-chip" style={{ color: "var(--aurora)" }}>♛ {zoneTicks} ZONE</span>
          </div>
        </div>

        <div className="arena-wrap">
          <div className="arena" style={{ "--n": N }}>
            {Array.from({ length: N * N }, (_, i) => {
              const isWall = arena.walls.has(i);
              const isZone = arena.zone.has(i);
              const rival = rivals.find((r) => r.pos === i);
              const isMe = me === i;
              const reachable = !isWall && dist(me, i) === 1;
              return (
                <div key={i} className={"acell" + (hitCell === i ? " hit" : "")}
                     data-wall={isWall ? "1" : undefined}
                     data-zone={isZone ? "1" : undefined}
                     style={reachable ? { boxShadow: "inset 0 0 0 1px rgba(93,246,255,.28)" } : undefined}
                     onClick={() => moveMe(i)}>
                  {flags.has(i) && <span className="aflag" style={{ fontSize: 15 }}>⚑</span>}
                  {powers.has(i) && <span className="apow" style={{ fontSize: 14, color: "var(--mint)" }}>⚡</span>}
                  {rival && (
                    <span className="aent rival" style={{ color: rival.color }}>
                      {leader.name === rival.name && <span className="crown">♛</span>}
                      {rival.glyph}
                    </span>
                  )}
                  {isMe && (
                    <span className="aent me">
                      {leader.me && <span className="crown">♛</span>}
                      <SatKing size={22} color="#5df6ff"/>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="ft dim" style={{ fontSize: 13, marginTop: 10, textAlign: "center" }}>
            click an adjacent cell or use <b className="frost">WASD / arrows</b> · ⚑ flags = 25 pts · ⚡ power = double step + steal · ♛ centre zone drips points
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <div className="panel-head">▸ live board</div>
          <div className="panel-body" style={{ padding: 8 }}>
            {board.map((b, i) => (
              <div key={b.name} className="lb-row" data-me={b.me ? "1" : undefined}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-name" style={{ color: b.color }}>
                  {i === 0 && "♛ "}{b.name}
                </span>
                <span className="lb-fl">⚑{b.flags}</span>
                <span className="lb-pts">{b.pts}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">▸ combat feed</div>
          <div className="panel-body" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {feed.map((f, i) => (
              <div key={i} style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5,
                                    color: f.c, opacity: 1 - i * 0.09 }}>{f.t}</div>
            ))}
          </div>
        </div>

        <CharSay who="cat">
          Every move you make is a transaction. Every transaction mines diesel.
          I am simultaneously winning and losing this match until the block observes me.
        </CharSay>
      </div>
    </div>
  );
}

Object.assign(window, { KingOfTheSat });
})();
