// FROST-BITE :: dog mode — the $DOG ARMY chaos engine
(function () {
  const { useState, useEffect, useRef } = React;

  const BARKS = [
    "BARK!",
    "WOOF!",
    "AWOO!",
    "BOW WOW!",
    "ARF ARF!",
    "BORK!",
    "HECKIN WIN!",
    "SUCH SAT!",
    "MOON!",
    "GOOD BOY!",
  ];
  const DOG_LINES = [
    "we go to the moon. we do not stop. we sniff every block.",
    "the pack does not read the whitepaper. the pack simply eats.",
    "every tap mines diesel. every diesel is a treat. simple.",
    "chaos is up. mines are up. treats are WAY up. no notes.",
    "i have located a squirrel in the mempool. investigating.",
  ];

  // ---- Dog army marching strip (grows with wins) ----
  function DogArmy({ troops, barking }) {
    const n = Math.max(1, Math.min(28, troops));
    return (
      <div className="dog-army">
        <span className="da-label">▸ $DOG ARMY · MARCHING</span>
        <span className="da-count">{troops} strong</span>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            marginTop: 18,
            width: "100%",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              className="dog-troop"
              style={{ animationDelay: (i % 4) * 0.12 + "s" }}
            >
              <DogSoldier
                size={30}
                rank={i % 9 === 8 ? 2 : i % 4 === 3 ? 1 : 0}
                barking={barking}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Chaos meter ----
  function ChaosMeter({ chaos, streak }) {
    return (
      <div className="chaos-meter">
        <div className="chaos-x">×{chaos.toFixed(1)}</div>
        <div>
          <div className="chaos-track">
            <i style={{ width: Math.min(100, (streak / 12) * 100) + "%" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 5,
              fontFamily: "var(--f-term)",
              fontSize: 12,
              color: "var(--silver)",
            }}
          >
            <span>
              chaos streak · <b className="gold">{streak}</b> picks without a
              bust
            </span>
            <span className="dim">mines ×2 · treats ×{chaos.toFixed(1)}</span>
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DogSoldier
            size={34}
            rank={streak > 8 ? 2 : streak > 4 ? 1 : 0}
            barking={streak > 6}
          />
        </div>
      </div>
    );
  }

  // ---- FETCH: bone drops at a random spot, click fast for a treat ----
  function FetchBone({ bone, onFetch }) {
    if (!bone) return null;
    return (
      <>
        <div
          className="fetch-ring"
          style={{ left: bone.x - 26, top: bone.y - 26, width: 52, height: 52 }}
        />
        <div
          className="fetch-bone"
          style={{ left: bone.x - 18, top: bone.y - 18 }}
          onClick={onFetch}
        >
          <Bone size={36} />
        </div>
      </>
    );
  }

  // ---- Floating barks ----
  function Barks({ barks }) {
    return barks.map((b) => (
      <div key={b.id} className="bark" style={{ left: b.x, top: b.y }}>
        {b.text}
      </div>
    ));
  }

  // ---- SQUIRREL cooldown (dog-mode version of touch grass) ----
  function SquirrelCooldown({ remaining, total }) {
    return (
      <div className="squirrel-veil">
        <div className="grass-card">
          <div className="squirrel-title">◉ SQUIRREL!! ◉</div>
          <div className="grass-sub" style={{ color: "#ffd9a0" }}>
            The entire $DOG ARMY has broken formation to pursue a squirrel
            through the mempool. Nobody is guarding the boards. This was always
            going to happen.
          </div>
          <div className="dog-chase">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ animationDelay: i * 0.08 + "s" }}>
                <DogSoldier size={46} rank={i === 4 ? 2 : 0} barking />
              </div>
            ))}
          </div>
          <div className="grass-count" style={{ color: "var(--gold)" }}>
            {remaining}
            <small>
              BLOCKS UNTIL THE PACK RETURNS · {total} BLOCK COOLDOWN
            </small>
          </div>
        </div>
      </div>
    );
  }

  // ---- hook: dog-mode chaos engine ----
  function useDogMode(active, { onTreat }) {
    const [bone, setBone] = useState(null);
    const [barks, setBarks] = useState([]);
    const barkId = useRef(0);
    const onTreatRef = useRef(onTreat);
    useEffect(() => {
      onTreatRef.current = onTreat;
    }, [onTreat]);

    // bone drops
    useEffect(() => {
      if (!active) {
        setBone(null);
        return;
      }
      let alive = true;
      function drop() {
        if (!alive) return;
        const pad = 90;
        setBone({
          id: Date.now(),
          x: pad + Math.random() * Math.max(60, window.innerWidth - pad * 2),
          y: pad + Math.random() * Math.max(60, window.innerHeight - pad * 2),
        });
        // bone escapes if ignored
        setTimeout(() => {
          if (alive) setBone(null);
        }, 3200);
      }
      const iv = setInterval(drop, 7000);
      const t = setTimeout(drop, 2500);
      return () => {
        alive = false;
        clearInterval(iv);
        clearTimeout(t);
      };
    }, [active]);

    function fetchBone() {
      if (!bone) return;
      setBone(null);
      pushBark("GOOD BOY!", bone.x, bone.y);
      onTreatRef.current && onTreatRef.current();
    }

    function pushBark(text, x, y) {
      const id = ++barkId.current;
      const b = {
        id,
        text: text || BARKS[Math.floor(Math.random() * BARKS.length)],
        x: x ?? 100 + Math.random() * Math.max(60, window.innerWidth - 260),
        y: y ?? 140 + Math.random() * 300,
      };
      setBarks((prev) => [...prev, b]);
      setTimeout(
        () => setBarks((prev) => prev.filter((p) => p.id !== id)),
        1000,
      );
    }

    return { bone, fetchBone, barks, pushBark };
  }

  Object.assign(window, {
    DogArmy,
    ChaosMeter,
    FetchBone,
    Barks,
    SquirrelCooldown,
    useDogMode,
    DOG_LINES,
    BARKS,
  });
})();
