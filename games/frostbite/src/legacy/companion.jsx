// FROST-BITE :: living companion — dances, moods, hints, cheers you on
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  const DANCES = ["bob", "spin", "break"];
  const DANCE_NAMES = { bob: "BOB", spin: "SPIN", break: "BREAK" };

  // mood cycles when you tap the character itself
  const TAP_MOODS = ["giggle", "cry", "angry"];

  const ART = {
    captain: (p) => <AlkaneCaptain {...p} />,
    frost: (p) => <MrFrost {...p} />,
    danni: (p) => <LtDanniDiesel {...p} />,
    wizard: (p) => <FrostWizard {...p} />,
    cat: (p) => <QuantumCat {...p} />,
    dog: (p) => <DogSoldier {...p} />,
    king: (p) => <SatKing {...p} />,
    miner: (p) => <DieselMiner {...p} />,
  };

  const SAYS = {
    giggle: {
      captain: "Ha. You found the seam I left open.",
      frost: "Delightful. Simply delightful.",
      danni: "HA! The rig loves that.",
      wizard: "Heh. The ice approves.",
      cat: "I laughed in both states at once.",
      dog: "HECKIN FUNNY! BARK!",
      king: "The crown is amused.",
      miner: "Heh — good swing.",
    },
    cry: {
      captain: "…the envelope is heavy today.",
      frost: "One does weep, occasionally, into the sherry.",
      danni: "Aw, the pot's gone dry.",
      wizard: "The mountain wins again.",
      cat: "I collapsed into the sad state. Rude.",
      dog: "the squirrel got away. again.",
      king: "A king may grieve a sat.",
      miner: "Seam ran out. It happens.",
    },
    angry: {
      captain: "Someone tested a red line. Noted.",
      frost: "I shall be very polite about this. Very.",
      danni: "WHO TOUCHED THE PRESSURE VALVE",
      wizard: "Do NOT scramble my bands.",
      cat: "OBSERVE ME PROPERLY.",
      dog: "GRRRR BORK BORK BORK",
      king: "OFF WITH IT.",
      miner: "That's my diesel, friend.",
    },
  };

  // contextual hints — genuinely useful, rotate per venue/state
  function hintsFor(s) {
    const H = [];
    if (s.venue === "arcade") {
      if (s.picksOnLive === 0)
        H.push(
          <>
            All four boards are <b>live right now</b> — play them all before the
            blocks land. Each one is a different game.
          </>,
        );
      if (s.picksOnLive > 0)
        H.push(
          <>
            Score <b>{s.picksOnLive}</b> banked on this board. The block
            confirms it into icicles — bust before then and it's zero.
          </>,
        );
      H.push(
        <>
          Hit the <b>↻</b> on any board to swap cabinets. Nine of them: sats,
          maze, buster, zapper, breaker, snake, climb, runner, stack.
        </>,
      );
      H.push(
        <>
          <b>ZAPPER</b> tip: shoot the <b>▲ fire</b> blocks first. Three of them
          and a ❄ glacier pays triple.
        </>,
      );
      H.push(
        <>
          <b>MAZE</b> tip: WASD or click a direction. Reaching the exit pays
          ×1.5 on the whole run.
        </>,
      );
      H.push(
        <>
          <b>RELEASE THE SATS</b> tip: the centre pit pays 5, the edges 2, and
          two pits are traps.
        </>,
      );
      if (s.icicles >= 300 && !s.glacierTier)
        H.push(
          <>
            You can afford an <b>ICE SHELF</b> — 3× on everything you cash out.
          </>,
        );
      if (s.mode === "diesel")
        H.push(
          <>
            You're in <b>DIESEL</b> — the core loop. Try <b>FIRE</b> for 2.2×
            payouts, or <b>AIR</b> for 88 blocks and an 11-block rest.
          </>,
        );
      H.push(
        <>
          Win cards drop into your <b>SATBAG</b> on the right — download or
          share without pausing the run.
        </>,
      );
      H.push(
        <>
          Every tap is a real transaction. <b>We pay the sats</b>, and the
          diesel comes back to you at cashout.
        </>,
      );
    } else if (s.venue === "kots") {
      H.push(
        <>
          <b>WASD</b> or click an adjacent cell. Flags are 25 points.
        </>,
      );
      H.push(
        <>
          Grab a <b>power core</b> and you move two cells and can steal a
          rival's flags.
        </>,
      );
      H.push(
        <>
          The purple centre is the <b>king zone</b> — it drips points while you
          stand in it.
        </>,
      );
    } else if (s.venue === "subzero") {
      H.push(
        <>
          <b>Drag</b> the globe to spin it. Click a hex to change its terrain.
        </>,
      );
      H.push(
        <>
          Use <b>◂ ▸</b> to roll a whole band at once — far faster than clicking
          hexes.
        </>,
      );
      H.push(
        <>
          <b>FUSE</b> snaps a band to one terrain but scrambles another. Use it
          late.
        </>,
      );
      H.push(
        <>
          Start on <b>EARTH</b>. Fire Falls will eat you.
        </>,
      );
    } else if (s.venue === "crew") {
      H.push(
        <>
          <b>Drag the carousel</b> or use arrow keys. Eight of us in here.
        </>,
      );
      H.push(
        <>
          Each of us carries a real perk. <b>Danni</b> mines 25% more diesel.
        </>,
      );
      H.push(<>Deploy me and I'll follow you around the arcade.</>);
    } else if (s.venue === "vault") {
      H.push(
        <>
          Glaciers stack: <b>3× / 6× / 9×</b>. Build before you cash out, not
          after.
        </>,
      );
      H.push(
        <>
          Your <b>orbital glacier</b> is generated from your play history. No
          two match.
        </>,
      );
    } else if (s.venue === "fortress") {
      H.push(
        <>
          Everything here is checkable. If a red line goes amber,{" "}
          <b>you see it first</b>.
        </>,
      );
    } else if (s.venue === "submit") {
      H.push(
        <>
          Anyone can build a cabinet. <b>Six gates</b>, two of them human, then{" "}
          <b>5% of the rake</b> forever.
        </>,
      );
      H.push(
        <>
          A public repo isn't required, but it makes the static scan
          reproducible — and you can't graduate closed-source.
        </>,
      );
    } else if (s.venue === "minercraft") {
      H.push(
        <>
          Four audits, then 30 days at 21+ players.{" "}
          <b>Nobody skips the gauntlet.</b>
        </>,
      );
    }
    return H.length
      ? H
      : [<>Tap me to change my dance. Tap again for a mood.</>];
  }

  function Companion({
    crewId,
    venue,
    gameMood,
    picksOnLive,
    mult,
    emptyBoards,
    icicles,
    glacierTier,
    mode,
    onTap,
  }) {
    const [dance, setDance] = useState("bob");
    const [tapMood, setTapMood] = useState(null);
    const [hintIx, setHintIx] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [taps, setTaps] = useState(0);
    const crew = (window.CREW || []).find((c) => c.id === crewId) || {
      name: "COMPANION",
      color: "#5df6ff",
    };
    const Art = ART[crewId] || ART.captain;

    // game-driven mood wins over tap mood
    const mood = gameMood || tapMood;

    const hints = hintsFor({
      venue,
      picksOnLive,
      mult,
      emptyBoards,
      icicles,
      glacierTier,
      mode,
    });

    // rotate hints
    useEffect(() => {
      setShowHint(true);
      const hide = setTimeout(() => setShowHint(false), 7200);
      const next = setTimeout(
        () => setHintIx((i) => (i + 1) % Math.max(1, hints.length)),
        9600,
      );
      return () => {
        clearTimeout(hide);
        clearTimeout(next);
      };
    }, [hintIx, venue]);

    // reset hint carousel when venue changes
    useEffect(() => {
      setHintIx(0);
    }, [venue]);

    // tap-moods decay
    useEffect(() => {
      if (!tapMood) return;
      const t = setTimeout(() => setTapMood(null), 2600);
      return () => clearTimeout(t);
    }, [tapMood]);

    // first tap changes dance, second sets a mood, and so on
    function tap(e) {
      e.stopPropagation();
      const n = taps + 1;
      setTaps(n);
      if (n % 2 === 1) {
        setDance((d) => DANCES[(DANCES.indexOf(d) + 1) % DANCES.length]);
      } else {
        const m = TAP_MOODS[Math.floor(n / 2 - 1) % TAP_MOODS.length];
        setTapMood(m);
        onTap && onTap(m, (SAYS[m] || {})[crewId]);
      }
      setShowHint(true);
      FBLog && FBLog.event("companion-tap", { crew: crewId, dance, tap: n });
    }

    const said = mood && (SAYS[mood] || {})[crewId];

    return (
      <div className="comp" style={{ "--cc": crew.color }}>
        <div className={"comp-hint" + (showHint ? " show" : "")}>
          {said || hints[hintIx % hints.length]}
        </div>
        <div
          className="comp-stage"
          data-mood={mood || undefined}
          onClick={tap}
          title="tap to change dance · tap again for a mood"
        >
          <div className="comp-hitring" />
          {taps === 0 && <span className="comp-tapme">TAP ME</span>}
          <div className="comp-art" data-dance={mood ? undefined : dance}>
            <Art
              size={78}
              mood={mood === "angry" ? "cast" : undefined}
              rank={crewId === "dog" ? 2 : undefined}
              barking={mood === "angry" || mood === "giggle"}
              striking={mood === "angry"}
            />
          </div>
          {mood === "giggle" && (
            <>
              <span className="emote laugh" style={{ right: 4, top: 22 }}>
                ♪
              </span>
              <span
                className="emote laugh"
                style={{ right: 14, top: 40, animationDelay: ".3s" }}
              >
                ha
              </span>
              <span
                className="emote laugh"
                style={{ right: 0, top: 8, animationDelay: ".6s" }}
              >
                ♫
              </span>
            </>
          )}
          {mood === "cry" && (
            <>
              <span className="emote tear" style={{ left: 34, top: 44 }} />
              <span
                className="emote tear"
                style={{ right: 32, top: 44, animationDelay: ".45s" }}
              />
              <span
                className="emote tear"
                style={{ left: 40, top: 40, animationDelay: ".8s" }}
              />
            </>
          )}
          {mood === "angry" && (
            <>
              <span className="emote steam" style={{ left: 12, top: 26 }} />
              <span
                className="emote steam"
                style={{ right: 10, top: 20, animationDelay: ".3s" }}
              />
              <span
                className="emote steam"
                style={{ left: 20, top: 14, animationDelay: ".55s" }}
              />
            </>
          )}
          {mood === "cheer" && (
            <>
              <span className="emote spark" style={{ right: 6, top: 20 }}>
                ✦
              </span>
              <span
                className="emote spark"
                style={{ left: 6, top: 28, animationDelay: ".35s" }}
              >
                ✧
              </span>
            </>
          )}
        </div>
        <div className="comp-plate">{crew.name}</div>
        <div className="comp-dots">
          {DANCES.map((d) => (
            <i
              key={d}
              data-on={!mood && dance === d ? "1" : undefined}
              title={DANCE_NAMES[d]}
              onClick={(e) => {
                e.stopPropagation();
                setDance(d);
                setTapMood(null);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  Object.assign(window, { Companion, COMP_DANCES: DANCES });
})();
