// FROST-BITE :: the crew — 3D spin-cycle character select with 9 stats
(function () {
const { useState, useEffect, useRef, useCallback } = React;

const STAT_KEYS = [
  { k: "luck",  label: "LUCK",  hint: "odds of a safe tile leaning your way" },
  { k: "grit",  label: "GRIT",  hint: "how long you survive a bust streak" },
  { k: "chill", label: "CHILL", hint: "resistance to rival knock-offs" },
  { k: "greed", label: "GREED", hint: "icicle yield per safe pick" },
  { k: "speed", label: "SPEED", hint: "extra step in King of the SAT" },
  { k: "nerve", label: "NERVE", hint: "hold picks through a reveal" },
  { k: "hash",  label: "HASH",  hint: "diesel mined per transaction" },
  { k: "chaos", label: "CHAOS", hint: "dog-mode bone drop frequency" },
  { k: "swag",  label: "SWAG",  hint: "badge and glacier mint rarity" },
];

const CREW = [
  { id: "captain", name: "THE ALKANE CAPTAIN", Art: () => <AlkaneCaptain size={112}/>, color: "#8effff",
    title: "keeper of the envelope",
    bio: "Nobody has seen under the hood. He signs the envelopes, he settles the boards, and he has never once explained himself.",
    perk: "ENVELOPE SEAL · your picks can't be front-run for 1 block",
    stats: { luck: 6, grit: 8, chill: 8, greed: 4, speed: 6, nerve: 9, hash: 9, chaos: 6, swag: 9 } },
  { id: "frost", name: "MR. FROST", Art: () => <MrFrost size={112}/>, color: "#dff2ff",
    title: "proprietor, terribly polite",
    bio: "Owns the house. Takes the fifteen percent. Will hold the door for you on the way to losing everything, and mean it.",
    perk: "HOUSE MANNERS · −3% house cut on every cashout",
    stats: { luck: 8, grit: 6, chill: 9, greed: 8, speed: 4, nerve: 5, hash: 5, chaos: 7, swag: 9 } },
  { id: "danni", name: "LT. DANNI DIESEL", Art: () => <LtDanniDiesel size={112}/>, color: "#ff6b35",
    title: "field engineer, rig division",
    bio: "Keeps every rig turning while the rest of you play games. If diesel flows, it's because she's under the floor with a wrench.",
    perk: "OVERCLOCK · +25% diesel mined per transaction",
    stats: { luck: 5, grit: 9, chill: 4, greed: 5, speed: 8, nerve: 8, hash: 7, chaos: 6, swag: 7 } },
  { id: "wizard", name: "THE FROST WIZARD", Art: () => <FrostWizard size={112}/>, color: "#5df6ff",
    title: "keeper of the subzero core",
    bio: "Built the Core, then locked himself out of it on purpose. Says the mountain is the point.",
    perk: "COLD READ · reveals one mine per Subzero band",
    stats: { luck: 7, grit: 5, chill: 9, greed: 3, speed: 4, nerve: 6, hash: 8, chaos: 5, swag: 8 } },
  { id: "cat", name: "QUANTUM CAT", Art: () => <QuantumCat size={112}/>, color: "#a280ff",
    title: "referee, king of the sat",
    bio: "Simultaneously winning and losing until the block observes her. Referees the arena from both outcomes at once.",
    perk: "SUPERPOSITION · first bust each round doesn't count",
    stats: { luck: 9, grit: 4, chill: 6, greed: 5, speed: 8, nerve: 7, hash: 9, chaos: 8, swag: 7 } },
  { id: "dog", name: "$DOG ARMY", Art: () => <DogSoldier size={112} rank={2}/>, color: "#ffd24a",
    title: "the pack, all of it",
    bio: "There is no single dog. There is only the pack, and the pack is going to the moon, and the pack has seen a squirrel.",
    perk: "PACK TACTICS · bones drop twice as often",
    stats: { luck: 5, grit: 8, chill: 2, greed: 7, speed: 9, nerve: 9, hash: 4, chaos: 9, swag: 6 } },
  { id: "king", name: "THE SAT KING", Art: () => <SatKing size={112}/>, color: "#ffd24a",
    title: "reigning, for now",
    bio: "Held the centre zone for nine blocks straight. Wears the crown until somebody knocks it off, which is the whole game.",
    perk: "CROWN WEIGHT · centre zone drips double points",
    stats: { luck: 6, grit: 7, chill: 5, greed: 9, speed: 5, nerve: 8, hash: 6, chaos: 4, swag: 9 } },
  { id: "miner", name: "RIG OPERATOR", Art: () => <DieselMiner size={112}/>, color: "#ff6b35",
    title: "swings the pick, every tx",
    bio: "Does not know the rules of any cabinet and does not care. Every tap you make turns his rig, and that's enough.",
    perk: "DEEP SEAM · diesel pot share ×1.5",
    stats: { luck: 4, grit: 9, chill: 6, greed: 6, speed: 5, nerve: 7, hash: 9, chaos: 3, swag: 5 } },
];

const RADIUS = 300;

function StatRow({ s, val, color, delay }) {
  return (
    <div className="stat-row">
      <span className="sr-label">{s.label}</span>
      <span className="sr-track">
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} data-on={i < val ? "1" : undefined}
             style={{ background: i < val ? color : undefined, transitionDelay: (delay + i * 22) + "ms" }}/>
        ))}
      </span>
      <span className="sr-val" style={{ color }}>{val}</span>
      <span className="sr-hint">{s.hint}</span>
    </div>
  );
}

function CrewSelect({ selected, onSelect, onMine }) {
  const [ix, setIx] = useState(() => Math.max(0, CREW.findIndex((c) => c.id === selected)));
  const [spin, setSpin] = useState(0);
  const [drag, setDrag] = useState(null);
  const step = 360 / CREW.length;

  const goTo = useCallback((next) => {
    const n = ((next % CREW.length) + CREW.length) % CREW.length;
    // shortest rotational path
    let delta = n - ix;
    if (delta > CREW.length / 2) delta -= CREW.length;
    if (delta < -CREW.length / 2) delta += CREW.length;
    setSpin((s) => s - delta * step);
    setIx(n);
  }, [ix, step]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(ix + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); goTo(ix - 1); }
      if (e.key === "Enter")      { onSelect(CREW[ix].id); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ix, goTo, onSelect]);

  // drag to spin
  function down(e) {
    const p = e.touches ? e.touches[0] : e;
    setDrag({ x: p.clientX, start: spin, moved: 0 });
  }
  useEffect(() => {
    if (!drag) return;
    function move(e) {
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - drag.x;
      setSpin(drag.start + dx * 0.45);
      setDrag((d) => d && { ...d, moved: Math.abs(dx) });
    }
    function up() {
      // snap to nearest slot
      setSpin((s) => {
        const slot = Math.round(-s / step);
        const n = ((slot % CREW.length) + CREW.length) % CREW.length;
        setIx(n);
        return -slot * step;
      });
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
  }, [drag, step]);

  const active = CREW[ix];
  const isPicked = selected === active.id;
  const total = Object.values(active.stats).reduce((a, b) => a + b, 0);

  return (
    <div className="crew">
      <div className="crew-stage">
        <div className="crew-ring-wrap" onMouseDown={down} onTouchStart={down}>
          <div className="crew-ring" style={{ transform: `translateZ(-${RADIUS}px) rotateY(${spin}deg)` }}>
            {CREW.map((c, i) => {
              const front = i === ix;
              return (
                <div key={c.id} className="crew-slot" data-front={front ? "1" : undefined}
                     style={{ transform: `rotateY(${i * step}deg) translateZ(${RADIUS}px)`,
                              "--cc": c.color }}
                     onClick={() => { if (!drag || drag.moved < 6) goTo(i); }}>
                  <div className="crew-plinth"/>
                  <div className="crew-art"><c.Art/></div>
                  <div className="crew-nameplate">{c.name}</div>
                  {selected === c.id && <span className="crew-active">◉ ACTIVE</span>}
                </div>
              );
            })}
          </div>
        </div>
        <button className="crew-arrow left"  onClick={() => goTo(ix - 1)}>◂</button>
        <button className="crew-arrow right" onClick={() => goTo(ix + 1)}>▸</button>
        <div className="crew-dots">
          {CREW.map((c, i) => (
            <i key={c.id} data-on={i === ix ? "1" : undefined}
               style={{ background: i === ix ? c.color : undefined }} onClick={() => goTo(i)}/>
          ))}
        </div>
      </div>

      <div className="crew-panel" style={{ "--cc": active.color }}>
        <div className="cp-head">
          <div>
            <div className="cp-name" style={{ color: active.color }}>{active.name}</div>
            <div className="cp-title">{active.title}</div>
          </div>
          <div className="cp-total">
            <b style={{ color: active.color }}>{total}</b>
            <small>TOTAL / 81</small>
          </div>
        </div>

        <div className="cp-bio">{active.bio}</div>

        <div className="cp-perk" style={{ borderColor: active.color }}>
          <span className="cp-perk-tag" style={{ background: active.color }}>PERK</span>
          <span>{active.perk}</span>
        </div>

        <div className="stat-grid">
          {STAT_KEYS.map((s, i) => (
            <StatRow key={s.k} s={s} val={active.stats[s.k]} color={active.color} delay={i * 40}/>
          ))}
        </div>

        <button className={"btn lg block" + (isPicked ? " disabled" : "")}
                style={{ marginTop: 16, borderColor: active.color, color: isPicked ? undefined : active.color }}
                disabled={isPicked}
                onClick={() => { onSelect(active.id); onMine && onMine("crew-select"); }}>
          {isPicked ? "◉ CURRENTLY DEPLOYED" : "▸ DEPLOY " + active.name}
        </button>
        <div className="ft dim" style={{ fontSize: 13, marginTop: 8, textAlign: "center" }}>
          drag the carousel · <b className="frost">◂ ▸</b> arrow keys · <b className="frost">enter</b> to deploy
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CrewSelect, CREW, STAT_KEYS });
})();
