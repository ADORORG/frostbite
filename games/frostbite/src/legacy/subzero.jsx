// FROST-BITE :: SUBZERO CORE — tactile hex-tiled globe puzzle, 4 themed worlds
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const R = 152;
  const TILE_W = 46;
  const LAT_MIN = -78,
    LAT_MAX = 78,
    RINGS = 13;
  // 13 latitude rings grouped into 5 solve-bands
  const BANDS = [
    [0, 1],
    [2, 3, 4],
    [5, 6, 7],
    [8, 9, 10],
    [11, 12],
  ];

  const WORLDS = {
    earth: {
      id: "earth",
      name: "EARTH",
      sub: "tutorial world",
      diff: 1,
      rivalRate: 0.55,
      knockOdds: 0.86,
      atmo: "#4aa3ff",
      space: "#03060f",
      palette: ["#15628f", "#2f9e5e", "#c9a54e", "#7a5334", "#e8f4ff"],
      props: ["#1d7a45", "#8f6b3a"],
    },
    titus: {
      id: "titus",
      name: "TITUS",
      sub: "violet rock world",
      diff: 2,
      rivalRate: 0.8,
      knockOdds: 0.8,
      atmo: "#a24dff",
      space: "#080418",
      palette: ["#5c34a0", "#a02f7e", "#d94f2b", "#38215c", "#dfb0ff"],
      props: ["#7a45c4", "#c4407a"],
    },
    frost: {
      id: "frost",
      name: "FROST MOUNTAIN",
      sub: "the original core",
      diff: 3,
      rivalRate: 1.05,
      knockOdds: 0.76,
      atmo: "#5df6ff",
      space: "#04060d",
      palette: ["#2e6bff", "#5df6ff", "#a8e6ff", "#6fffb0", "#f2fbff"],
      props: ["#8effff", "#2456d6"],
    },
    fire: {
      id: "fire",
      name: "FIRE FALLS",
      sub: "molten endgame",
      diff: 4,
      rivalRate: 1.4,
      knockOdds: 0.7,
      atmo: "#ff6b35",
      space: "#100402",
      palette: ["#d41e1e", "#ff6b35", "#ffd24a", "#2b1208", "#ff2d9d"],
      props: ["#ffd24a", "#ff2d9d"],
    },
  };
  const WORLD_KEYS = ["earth", "titus", "frost", "fire"];

  // ---- build the hex sphere ----
  function buildGlobe(worldKey, seed) {
    const w = WORLDS[worldKey];
    let s = seed >>> 0 || 17;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    const tiles = [];
    for (let r = 0; r < RINGS; r++) {
      const lat = LAT_MIN + (r / (RINGS - 1)) * (LAT_MAX - LAT_MIN);
      const circ = 2 * Math.PI * R * Math.cos((lat * Math.PI) / 180);
      const n = Math.max(4, Math.round(circ / TILE_W));
      const offset = (r % 2) * (360 / n / 2);
      for (let i = 0; i < n; i++) {
        tiles.push({
          ring: r,
          band: BANDS.findIndex((b) => b.includes(r)),
          lat,
          lon: (i / n) * 360 + offset,
          i,
          c: Math.floor(rnd() * w.palette.length),
          prop: rnd() > 0.72 ? Math.floor(rnd() * w.props.length) : -1,
        });
      }
    }
    return tiles;
  }

  function SubzeroCore({ onSolve, onMine, playsLeft, daysLeft, mode }) {
    const [world, setWorld] = useState("frost");
    const [tiles, setTiles] = useState(() =>
      buildGlobe("frost", Date.now() % 99991),
    );
    const [rot, setRot] = useState({ x: -16, y: 22 });
    const [vel, setVel] = useState({ x: 0, y: 0.2 });
    const [drag, setDrag] = useState(null);
    const [moves, setMoves] = useState(0);
    const [rivalProg, setRivalProg] = useState(6);
    const [knock, setKnock] = useState(null);
    const [solved, setSolved] = useState(false);
    const [flash, setFlash] = useState([]);
    const [solves, setSolves] = useState(0);
    const w = WORLDS[world];
    const tilesRef = useRef(tiles);
    tilesRef.current = tiles;

    function loadWorld(k) {
      setWorld(k);
      setTiles(buildGlobe(k, Date.now() % 99991));
      setMoves(0);
      setRivalProg(6);
      setSolved(false);
      onMine && onMine("world-load");
    }

    // idle spin + inertia
    useEffect(() => {
      let raf;
      function loop() {
        setRot((r) => ({ x: r.x + vel.x, y: r.y + vel.y }));
        raf = requestAnimationFrame(loop);
      }
      if (!drag) raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [vel, drag]);
    useEffect(() => {
      const iv = setInterval(
        () => setVel((v) => ({ x: v.x * 0.93, y: v.y * 0.93 + 0.2 * 0.07 })),
        60,
      );
      return () => clearInterval(iv);
    }, []);

    // drag
    function down(e) {
      const p = e.touches ? e.touches[0] : e;
      setDrag({ lx: p.clientX, ly: p.clientY, moved: 0 });
    }
    useEffect(() => {
      if (!drag) return;
      function move(e) {
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - drag.lx,
          dy = p.clientY - drag.ly;
        setRot((r) => ({
          x: Math.max(-82, Math.min(82, r.x - dy * 0.38)),
          y: r.y + dx * 0.48,
        }));
        setVel({ x: -dy * 0.07, y: dx * 0.09 });
        setDrag(
          (d) =>
            d && {
              ...d,
              lx: p.clientX,
              ly: p.clientY,
              moved: d.moved + Math.abs(dx) + Math.abs(dy),
            },
        );
      }
      function up() {
        setDrag(null);
      }
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", up);
      return () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        window.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", up);
      };
    }, [drag]);

    // click a hex → cycle colour
    function cycleTile(idx, e) {
      e.stopPropagation();
      if (solved || (drag && drag.moved > 8)) return;
      setTiles((ts) =>
        ts.map((t, i) =>
          i === idx ? { ...t, c: (t.c + 1) % w.palette.length } : t,
        ),
      );
      setMoves((m) => m + 1);
      onMine && onMine("core-click");
    }

    // roll a band's colours around the sphere
    function rollBand(band, dir) {
      if (solved) return;
      setTiles((ts) => {
        const inBand = ts
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.band === band);
        const cols = inBand.map(({ t }) => t.c);
        const rolled =
          dir > 0
            ? [cols[cols.length - 1], ...cols.slice(0, -1)]
            : [...cols.slice(1), cols[0]];
        const map = new Map(inBand.map(({ i }, k) => [i, rolled[k]]));
        return ts.map((t, i) => (map.has(i) ? { ...t, c: map.get(i) } : t));
      });
      setMoves((m) => m + 1);
      setVel((v) => ({ ...v, y: v.y + dir * 2 }));
      onMine && onMine("core-roll");
    }

    // FUSE a band to its majority colour — but it scrambles a random other band
    function fuseBand(band) {
      if (solved) return;
      const inBand = tilesRef.current.filter((t) => t.band === band);
      const tally = {};
      inBand.forEach((t) => {
        tally[t.c] = (tally[t.c] || 0) + 1;
      });
      const majority = Number(
        Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0],
      );
      const others = BANDS.map((_, i) => i).filter((i) => i !== band);
      const victim = others[Math.floor(Math.random() * others.length)];
      setTiles((ts) =>
        ts.map((t) => {
          if (t.band === band) return { ...t, c: majority };
          if (t.band === victim)
            return { ...t, c: Math.floor(Math.random() * w.palette.length) };
          return t;
        }),
      );
      setFlash(
        tilesRef.current
          .map((t, i) => (t.band === victim ? i : -1))
          .filter((i) => i >= 0),
      );
      setTimeout(() => setFlash([]), 520);
      setMoves((m) => m + 3);
      setKnock({
        who: "FUSION BACKLASH",
        ring: victim,
        id: Date.now(),
        self: true,
      });
      setTimeout(() => setKnock(null), 900);
      onMine && onMine("core-fuse");
    }

    // band status
    const bandState = BANDS.map((_, b) => {
      const inBand = tiles.filter((t) => t.band === b);
      const first = inBand[0]?.c;
      const done = inBand.length > 0 && inBand.every((t) => t.c === first);
      const tally = {};
      inBand.forEach((t) => {
        tally[t.c] = (tally[t.c] || 0) + 1;
      });
      const lead = Object.keys(tally).sort((a, b2) => tally[b2] - tally[a])[0];
      return {
        band: b,
        done,
        size: inBand.length,
        colors: Object.keys(tally).map(Number),
        pct: inBand.length
          ? Math.round(((tally[lead] || 0) / inBand.length) * 100)
          : 0,
      };
    });
    const solvedCount = bandState.filter((b) => b.done).length;

    useEffect(() => {
      if (solved) return;
      if (solvedCount === BANDS.length) {
        setSolved(true);
        setSolves((s) => s + 1);
        onSolve && onSolve(moves);
      }
    }, [solvedCount, solved, moves]);

    // rivals creep + knock you off
    useEffect(() => {
      if (solved) return;
      const iv = setInterval(() => {
        setRivalProg((p) =>
          Math.min(100, p + w.rivalRate * (0.6 + Math.random())),
        );
        if (Math.random() > w.knockOdds) {
          const who = [
            "QUANTUM CAT",
            "MR. FROST",
            "$DOG ARMY",
            "THE ALKANE CAPTAIN",
          ][Math.floor(Math.random() * 4)];
          const band = Math.floor(Math.random() * BANDS.length);
          setKnock({ who, ring: band, id: Date.now() });
          setTiles((ts) =>
            ts.map((t) =>
              t.band === band
                ? { ...t, c: Math.floor(Math.random() * w.palette.length) }
                : t,
            ),
          );
          setFlash(
            tilesRef.current
              .map((t, i) => (t.band === band ? i : -1))
              .filter((i) => i >= 0),
          );
          setTimeout(() => setFlash([]), 520);
          setTimeout(() => setKnock(null), 950);
        }
      }, 2600);
      return () => clearInterval(iv);
    }, [solved, world]);

    return (
      <div className="subzero">
        <div>
          {/* world / level picker */}
          <div className="world-bar">
            {WORLD_KEYS.map((k) => {
              const ww = WORLDS[k];
              return (
                <button
                  key={k}
                  className="world-tab"
                  data-on={world === k ? "1" : undefined}
                  style={{ "--wc": ww.atmo }}
                  onClick={() => loadWorld(k)}
                >
                  <span className="wt-orb" />
                  <span className="wt-txt">
                    <b>{ww.name}</b>
                    <i>{ww.sub}</i>
                  </span>
                  <span className="wt-diff">{"◆".repeat(ww.diff)}</span>
                </button>
              );
            })}
          </div>

          <div
            className="globe-stage"
            style={{ "--atmo": w.atmo, "--space": w.space }}
            onMouseDown={down}
            onTouchStart={down}
          >
            <div className="starfield" />
            <div className="globe-atmo" />
            <div
              className="globe"
              style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}
            >
              <div
                className="globe-core"
                style={{
                  background: `radial-gradient(circle at 38% 32%, ${w.atmo}, ${w.space} 72%)`,
                }}
              />
              {tiles.map((t, idx) => (
                <div
                  key={idx}
                  className={
                    "hex" +
                    (flash.includes(idx) ? " hflash" : "") +
                    (bandState[t.band].done ? " hdone" : "")
                  }
                  style={{
                    transform: `rotateY(${t.lon}deg) rotateX(${-t.lat}deg) translateZ(${R}px)`,
                    background: w.palette[t.c],
                    "--hc": w.palette[t.c],
                  }}
                  onClick={(e) => cycleTile(idx, e)}
                >
                  {t.prop >= 0 && (
                    <span
                      className="hex-prop"
                      style={{ background: w.props[t.prop] }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="globe-spec" />
            <div className="globe-shadow" />

            {knock && (
              <div className="knock">
                <span
                  style={{
                    color: knock.self ? "var(--gold)" : "var(--magenta)",
                  }}
                >
                  {knock.who}
                  <br />
                  {knock.self
                    ? "SCRAMBLED BAND " + (knock.ring + 1)
                    : "KNOCKED YOU OFF THE SPOT"}
                  <br />
                  <small
                    style={{
                      fontFamily: "var(--f-term)",
                      fontSize: 16,
                      color: "var(--silver)",
                    }}
                  >
                    band {knock.ring + 1} randomised
                  </small>
                </span>
              </div>
            )}
            {solved && (
              <div
                className="knock"
                style={{
                  animation: "none",
                  background:
                    "radial-gradient(circle,rgba(111,255,176,.3),transparent 66%)",
                }}
              >
                <span style={{ color: "var(--mint)" }}>
                  ◆ {w.name} STABILISED ◆<br />
                  <small
                    style={{
                      fontFamily: "var(--f-term)",
                      fontSize: 17,
                      color: "var(--paper)",
                    }}
                  >
                    {moves} moves · 9× icicle bonus banked
                  </small>
                </span>
              </div>
            )}

            <div className="globe-hud">
              <span className="gh-world" style={{ color: w.atmo }}>
                {w.name}
              </span>
              <span className="gh-sep">·</span>
              <span>{tiles.length} HEXES</span>
              <span className="gh-sep">·</span>
              <span>
                {solvedCount}/{BANDS.length} BANDS STABLE
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel">
            <div className="panel-head">
              <span>▸ stabilise the bands</span>
              <span>
                {solvedCount}/{BANDS.length}
              </span>
            </div>
            <div className="panel-body" style={{ padding: 12 }}>
              <div className="ring-ctl">
                {bandState.map((b) => (
                  <div
                    key={b.band}
                    className="band-btn"
                    data-done={b.done ? "1" : undefined}
                  >
                    <span className="bb-id">B{b.band + 1}</span>
                    <div className="bb-bar">
                      <i
                        style={{
                          width: b.pct + "%",
                          background: b.done ? "var(--mint)" : w.atmo,
                        }}
                      />
                      <span>{b.pct}%</span>
                    </div>
                    <span className="bb-n">{b.size}</span>
                    <span
                      className="bb-act"
                      onClick={() => rollBand(b.band, -1)}
                      title="roll band left"
                    >
                      ◂
                    </span>
                    <span
                      className="bb-act"
                      onClick={() => rollBand(b.band, 1)}
                      title="roll band right"
                    >
                      ▸
                    </span>
                    <span
                      className="bb-fuse"
                      onClick={() => fuseBand(b.band)}
                      title="fuse to majority — scrambles another band"
                    >
                      FUSE
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="ft dim"
                style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}
              >
                <b className="frost">drag</b> to spin the globe ·{" "}
                <b className="frost">click a hex</b> to cycle terrain ·
                <b className="frost"> ◂ ▸</b> rolls a band ·{" "}
                <b className="gold">FUSE</b> snaps a band to its majority but
                randomises another. Every band one terrain = stabilised.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">▸ pressure</div>
            <div className="panel-body" style={{ padding: 12 }}>
              <div
                style={{
                  fontFamily: "var(--f-display)",
                  fontSize: 8,
                  color: "var(--silver)",
                  letterSpacing: ".1em",
                  marginBottom: 6,
                }}
              >
                RIVAL SOLVE PROGRESS · {w.name} PACE
              </div>
              <div className="rival-bar">
                <i style={{ width: rivalProg + "%" }} />
              </div>
              <div className="ft dim" style={{ fontSize: 13, marginTop: 6 }}>
                {rivalProg > 70 ? (
                  <span className="hot">
                    a rival is about to break the core
                  </span>
                ) : (
                  "rivals will scramble your bands without warning"
                )}
              </div>
              <div className="sz-window" style={{ marginTop: 14 }}>
                <div className="sz-stat">
                  <b>{daysLeft}</b>
                  <small>DAYS LEFT IN WINDOW</small>
                </div>
                <div className="sz-stat">
                  <b>{playsLeft}</b>
                  <small>PLAYS LEFT THIS YEAR</small>
                </div>
                <div className="sz-stat">
                  <b>{moves}</b>
                  <small>MOVES · EACH A TX</small>
                </div>
                <div className="sz-stat">
                  <b>{solves}</b>
                  <small>WORLDS STABILISED</small>
                </div>
              </div>
            </div>
          </div>

          <CharSay who="captain">
            Four worlds, one rule: every band a single terrain. Earth forgives.
            Fire Falls does not. Rivals reach in and scramble what you have
            sorted — that is not a bug, that is the mountain.
          </CharSay>
        </div>
      </div>
    );
  }

  Object.assign(window, { SubzeroCore, WORLDS });
})();
