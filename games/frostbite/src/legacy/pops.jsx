// FROST-BITE :: POPS — every mode drops its own collectible, like $DOG's bones
// A score that only ticks a counter is invisible. These are things you grab.
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  // Each mode gets a collectible with its own look, name and reward shape.
  const POPS = {
    diesel: {
      id: "diesel",
      glyph: "⬢",
      name: "DROPLET",
      color: "#ff6b35",
      reward: [4, 9],
      fuse: 3400,
      blurb: "raw diesel, straight off the rig",
    },
    agent: {
      id: "agent",
      glyph: "◈",
      name: "PACKET",
      color: "#a280ff",
      reward: [3, 7],
      fuse: 2600,
      blurb: "an unindexed packet, grab it before it settles",
    },
    dog: {
      id: "dog",
      glyph: "🦴",
      name: "BONE",
      color: "#ffd24a",
      reward: [6, 14],
      fuse: 3000,
      blurb: "BONE. BONE. GET THE BONE.",
    },
    fire: {
      id: "fire",
      glyph: "▲",
      name: "EMBER",
      color: "#ff2d9d",
      reward: [8, 18],
      fuse: 2000,
      blurb: "burns out fast, pays the most",
    },
    air: {
      id: "air",
      glyph: "✧",
      name: "DRIFT",
      color: "#c8f0ff",
      reward: [2, 5],
      fuse: 5200,
      blurb: "floats forever, worth little, always there",
    },
    cheese: {
      id: "cheese",
      glyph: "◍",
      name: "CURD",
      color: "#ffe066",
      reward: [1, 21],
      fuse: 3200,
      blurb: "worth between one and twenty-one. nobody knows why",
    },
  };

  function usePops(mode, active, onCollect) {
    const [pop, setPop] = useState(null);
    const [floats, setFloats] = useState([]);
    const cfg = POPS[mode] || POPS.diesel;
    const cfgRef = useRef(cfg);
    cfgRef.current = cfg;

    // spawn loop
    useEffect(() => {
      if (!active) {
        setPop(null);
        return;
      }
      let t;
      function schedule() {
        t = setTimeout(
          () => {
            const c = cfgRef.current;
            setPop({
              id: Math.random(),
              x: 8 + Math.random() * 74, // vw, kept off the right-edge drawers
              y: 22 + Math.random() * 52, // vh, kept off the HUD and action row
              born: Date.now(),
              fuse: c.fuse,
              cfg: c,
            });
            schedule();
          },
          5200 + Math.random() * 6500,
        );
      }
      schedule();
      return () => clearTimeout(t);
    }, [active, mode]);

    // fuse
    useEffect(() => {
      if (!pop) return;
      const t = setTimeout(() => setPop(null), pop.fuse);
      return () => clearTimeout(t);
    }, [pop]);

    const grab = useCallback(() => {
      if (!pop) return;
      const c = pop.cfg;
      const [lo, hi] = c.reward;
      const amt = lo + Math.floor(Math.random() * (hi - lo + 1));
      const f = {
        id: Math.random(),
        x: pop.x,
        y: pop.y,
        amt,
        color: c.color,
        name: c.name,
      };
      setFloats((v) => [...v, f]);
      setTimeout(() => setFloats((v) => v.filter((k) => k.id !== f.id)), 1400);
      setPop(null);
      onCollect && onCollect(amt, c);
    }, [pop, onCollect]);

    return { pop, floats, grab, cfg };
  }

  function PopLayer({ pop, floats, onGrab }) {
    return (
      <>
        {pop && (
          <button
            className="pop"
            style={{
              left: pop.x + "vw",
              top: pop.y + "vh",
              "--pc": pop.cfg.color,
            }}
            onClick={onGrab}
            title={pop.cfg.blurb}
          >
            <span className="pop-glyph">{pop.cfg.glyph}</span>
            <span className="pop-ring" />
            <span className="pop-name">{pop.cfg.name}</span>
          </button>
        )}
        {floats.map((f) => (
          <span
            key={f.id}
            className="pop-float"
            style={{ left: f.x + "vw", top: f.y + "vh", "--pc": f.color }}
          >
            +{f.amt}
          </span>
        ))}
      </>
    );
  }

  // a small always-on readout so the player knows what to look for in this mode
  function PopHint({ mode }) {
    const c = POPS[mode] || POPS.diesel;
    return (
      <span className="pop-hint" style={{ "--pc": c.color }}>
        <b>{c.glyph}</b> {c.name}
      </span>
    );
  }

  Object.assign(window, { usePops, PopLayer, PopHint, POPS });
})();
