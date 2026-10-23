// FROST-BITE :: main app — venues, economy, diesel mining, modes
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
    blockSec: 20,
    mines: 5,
    houseCut: 15,
    crt: 0.55,
    snow: true,
    mascot: true,
    unlockAll: false,
    shortSessions: true,
  }; /*EDITMODE-END*/

  const DIESEL_PER_TX = 0.0021;
  const ICICLE_BASE = 50;
  const DIESEL_POT = 84000;

  // ---------- board helpers ----------
  function buildBoardForGame(gameKey, seed, tweakMines, modeKey) {
    const game = GAMES9[gameKey] || GAMES9.sats;
    const m = MODES[modeKey] || MODES.human;
    let mines = tweakMines;
    if (m.mineMult === "chaos")
      mines = 1 + Math.floor(Math.random() * Math.min(9, game.cells - 2));
    else mines = Math.max(1, Math.round(mines * m.mineMult));
    mines = Math.min(game.cells - 2, mines);
    const state = game.generate(seed, mines);
    if (modeKey === "dog") {
      const bones = [];
      for (let i = 0; i < 3; i++) {
        const c = Math.floor(Math.random() * game.cells);
        if (!state.mines.includes(c)) bones.push(c);
      }
      state.bones = bones;
    }
    return {
      seed,
      gameKey,
      state,
      picks: [],
      run: { score: 0, busted: false, done: false, started: false },
      revealed: false,
      status: "pending",
      payout: 0,
      icicles: 0,
      flash: null,
    };
  }
  function freshSession(seedBase, mines, modeKey) {
    const slots = ["sats", "maze", "buster", "zapper"];
    return slots.map((k, i) =>
      buildBoardForGame(k, (seedBase >>> 0) + i * 131, mines, modeKey),
    );
  }

  // ---------- ambient mode particles ----------
  function ModeAmbience({ mode }) {
    if (mode === "fire")
      return (
        <>
          {Array.from({ length: 26 }, (_, i) => (
            <span
              key={i}
              className="ember"
              style={{
                left: ((i * 137) % 100) + "%",
                animationDuration: 5 + (i % 5) * 1.6 + "s",
                animationDelay: (i % 9) * 0.7 + "s",
                "--drift": ((i * 53) % 90) - 45 + "px",
              }}
            />
          ))}
        </>
      );
    if (mode === "air")
      return (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="feather"
              style={{
                left: ((i * 173) % 100) + "%",
                fontSize: 12 + (i % 4) * 5 + "px",
                animationDuration: 9 + (i % 6) * 2.4 + "s",
                animationDelay: (i % 8) * 1.1 + "s",
                "--drift": ((i * 71) % 160) - 80 + "px",
              }}
            >
              {i % 3 === 0 ? "≈" : i % 3 === 1 ? "❯" : "✧"}
            </span>
          ))}
        </>
      );
    if (mode === "cheese")
      return (
        <>
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="crumb"
              style={{
                left: ((i * 149) % 100) + "%",
                animationDuration: 7 + (i % 5) * 1.8 + "s",
                animationDelay: (i % 7) * 0.9 + "s",
                "--drift": ((i * 61) % 120) - 60 + "px",
              }}
            />
          ))}
        </>
      );
    return null;
  }

  // ---------- splash ----------
  function Splash({ onStart }) {
    const [v, setV] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setV(true), 250);
      return () => clearTimeout(t);
    }, []);
    return (
      <div className="splash" onClick={onStart}>
        <div className="splash-box">
          <div className="splash-logo">
            FROST<span className="b">·</span>BITE
          </div>
          <div className="splash-line" />
          <div className="splash-tag">
            a predictive minefield · on bitcoin · via alkanes
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 18,
              marginTop: 28,
              alignItems: "flex-end",
            }}
          >
            <FrostWizard size={54} />
            <QuantumCat size={54} />
            <DogSoldier size={54} rank={1} />
            <SatKing size={54} />
            <DieselMiner size={54} />
          </div>
          {v && (
            <div className="splash-press">▸ PRESS ANY KEY TO INSERT COIN</div>
          )}
        </div>
      </div>
    );
  }

  // ---------- locked venue gate ----------
  function Gate({ ic, title, sub, have, need, unit }) {
    return (
      <div className="gate">
        <div>
          <div className="gate-ic">{ic}</div>
          <div className="gate-title">{title}</div>
          <div className="gate-sub">{sub}</div>
          <div className="gate-prog">
            <div className="gate-track">
              <i style={{ width: Math.min(100, (have / need) * 100) + "%" }} />
            </div>
            <div className="gate-nums">
              <span>
                <b className="frost">{have}</b> {unit}
              </span>
              <span className="dimmer">
                {need} {unit} needed
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- vault (economy rail) ----------
  function VaultPanel({
    icicles,
    diesel,
    glacierTokens,
    txCount,
    glacierTier,
    onBuild,
    xp,
    badges,
    playShare,
  }) {
    return (
      <>
        <div className="panel">
          <div className="panel-head">▸ vault</div>
          <div className="panel-body" style={{ padding: 14 }}>
            <div className="icicle-big">
              {icicles.toLocaleString()} <span>ICICLES</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="kv">
                <span className="k">diesel mined</span>
                <span className="v" style={{ color: "var(--hot)" }}>
                  {diesel.toFixed(4)}
                </span>
              </div>
              <div className="kv">
                <span className="k">GLACIER (on-chain)</span>
                <span className="v" style={{ color: "var(--mint)" }}>
                  {glacierTokens.toFixed(3)}
                </span>
              </div>
              <div className="kv">
                <span className="k">tx broadcast</span>
                <span className="v">{txCount}</span>
              </div>
              <div className="kv">
                <span className="k">pot share</span>
                <span className="v gold" style={{ color: "var(--gold)" }}>
                  {(playShare * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <LevelBar xp={xp} />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">▸ erect a glacier</div>
          <div className="panel-body" style={{ padding: 12 }}>
            <GlacierBuilder
              icicles={icicles}
              built={glacierTier}
              onBuild={onBuild}
            />
            <div
              className="ft dim"
              style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45 }}
            >
              Bigger glacier, bigger cashout. Bonuses stack at{" "}
              <b className="frost">3×</b> /{" "}
              <b className="mint" style={{ color: "var(--mint)" }}>
                6×
              </b>{" "}
              / <b style={{ color: "var(--aurora)" }}>9×</b>.
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>▸ badge case</span>
            <span>
              {badges.length}/{BADGES.length}
            </span>
          </div>
          <div className="panel-body" style={{ padding: 12 }}>
            <BadgeCase earned={badges} />
          </div>
        </div>
      </>
    );
  }

  // ============================================================
  function App() {
    const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

    // identity
    const skip =
      typeof window !== "undefined" && window.location.search.includes("skip");
    const [profile, setProfile] = useState(
      skip ? { handle: "FROSTY", mode: "diesel", wallet: "UNISAT" } : null,
    );
    const [showSplash, setShowSplash] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showCashout, setShowCashout] = useState(false);

    // venue
    const [venue, setVenue] = useState("arcade");

    // chain
    const [height, setHeight] = useState(871234);
    const [progress, setProgress] = useState(0);

    // economy
    const [icicles, setIcicles] = useState(0);
    const [diesel, setDiesel] = useState(0);
    const [txCount, setTxCount] = useState(0);
    const [glacierTokens, setGlacierTokens] = useState(0);
    const [glacierTier, setGlacierTier] = useState(0);
    const [xp, setXp] = useState(0);
    const [badges, setBadges] = useState([]);
    const [striking, setStriking] = useState(false);
    const [sparks, setSparks] = useState([]);

    // progression counters
    const [gamesPlayed, setGamesPlayed] = useState(0);
    const [gamesWon, setGamesWon] = useState(0);
    const [daysPlayed, setDaysPlayed] = useState(0);
    const [subzeroPlays, setSubzeroPlays] = useState(0);

    // mode / budget
    const [mode, setMode] = useState("diesel");
    const [blocksUsed, setBlocksUsed] = useState(0);
    const [cooling, setCooling] = useState(false);
    const [cooldownLeft, setCooldownLeft] = useState(0);

    // dog mode
    const [chaosStreak, setChaosStreak] = useState(0);
    const [troops, setTroops] = useState(3);
    const [fetches, setFetches] = useState(0);

    // v0.6 — audio, confetti, satbag, ads, submit
    const AU = useAudio();
    const CH = useChain({ startHeight: 871234 });
    const [winStreak, setWinStreak] = useState(0);
    const [confetti, setConfetti] = useState(null);
    const [cards, setCards] = useState([]);
    const [cardToast, setCardToast] = useState(null);
    const [bagOpen, setBagOpen] = useState(false);
    const [seenCards, setSeenCards] = useState(0);
    const [jukeOpen, setJukeOpen] = useState(false);
    const [forceMood, setForceMood] = useState(null);
    const [relics, setRelics] = useState(0);
    const [stakesUp, setStakesUp] = useState(false);
    const [railL, setRailL] = useState(true);
    const [railR, setRailR] = useState(true);
    const [sheet, setSheet] = useState(null);
    const [cine, setCine] = useState(!skip);
    const cineArmed = useRef(false);

    // v0.4 — crew, satoshi, tutorial, telemetry
    const [crewId, setCrewId] = useState("captain");
    const [blocksSeen, setBlocksSeen] = useState(0);
    const [showWalk, setShowWalk] = useState(false);
    const [showBug, setShowBug] = useState(false);
    const [milestones, setMilestones] = useState({});
    // PLATFORM: a mark is also reported to the platform, which keeps it if the game's manifest declares it.
    const mark = useCallback((k) => {
      if (window.FrostbiteHost) window.FrostbiteHost.milestone(k);
      setMilestones((m) => (m[k] ? m : { ...m, [k]: true }));
    }, []);

    // session
    const [session, setSession] = useState(() =>
      freshSession(871234, TWEAK_DEFAULTS.mines, "diesel"),
    );
    const [currentIx, setCurrentIx] = useState(0);
    const [pickerFor, setPickerFor] = useState(null);
    const [toast, setToast] = useState(null);
    const [mood, setMood] = useState("idle");
    const [bubble, setBubble] = useState(null);

    const isDog = mode === "dog";
    const modeCfg = MODES[mode];
    const budgetMax = tweaks.shortSessions
      ? Math.max(4, Math.round(modeCfg.blocks / 8))
      : modeCfg.blocks;
    const coolMax = tweaks.shortSessions
      ? Math.max(3, Math.round(modeCfg.cool / 8))
      : modeCfg.cool;

    // refs
    const R = useRef({});
    R.current = {
      session,
      currentIx,
      tweaks,
      mode,
      isDog,
      blocksUsed,
      cooling,
      chaosStreak,
      budgetMax,
      coolMax,
      winStreak,
      height,
      profile,
    };

    // ---- telemetry context: every log entry carries this ----
    const ctxSnapshot = () => ({
      venue,
      mode,
      height,
      txCount,
      icicles: Math.round(icicles),
      diesel: Number(diesel.toFixed(4)),
      glacierTier,
      crew: crewId,
      level: Math.floor(xp / XP_PER_LEVEL) + 1,
      cooling,
    });
    useEffect(() => {
      FBLog.setContext(ctxSnapshot);
    });

    // Cinematic score. Browsers block audio until a gesture, so the cold open arms itself on
    // the first interaction of any kind and hands over to the lobby loop when the player enters.
    useEffect(() => {
      if (!cine) return;
      function arm() {
        if (cineArmed.current) return;
        cineArmed.current = true;
        AU.setTrack(9); // COLD OPEN
        AU.setOn(true);
        AU.setMusicOn(true);
      }
      window.addEventListener("pointerdown", arm, { once: true });
      window.addEventListener("keydown", arm, { once: true });
      return () => {
        window.removeEventListener("pointerdown", arm);
        window.removeEventListener("keydown", arm);
      };
    }, [cine]);

    // entering the arcade drops the score into the lobby loop
    useEffect(() => {
      if (cine || !cineArmed.current) return;
      AU.setTrack(0);
    }, [cine]);

    const POP = usePops(
      mode,
      !!profile &&
        !cine &&
        !showSplash &&
        !showWallet &&
        !cooling &&
        venue === "arcade",
      (amt, cfg) => {
        setIcicles((v) => v + amt);
        setXp((v) => v + 8);
        mineDiesel("pop");
        AU.play(amt >= 12 ? "jackpot" : "coin");
        FBLog.event("pop-collected", { mode, amt, kind: cfg.id });
        if (mode === "dog") dog.pushBark("GOT IT!");
      },
    );

    const sat = useSatoshi(!!profile && !cine && !showSplash && !showWallet, {
      blocksSeen,
      milestones,
    });

    // ---- diesel mining: EVERY tx mines ----
    const mineDiesel = useCallback((kind, x, y) => {
      const rate = R.current.isDog ? DIESEL_PER_TX * 2 : DIESEL_PER_TX;
      setDiesel((d) => d + rate);
      setTxCount((c) => c + 1);
      setXp((v) => v + 1);
      setStriking(true);
      setTimeout(() => setStriking(false), 300);
      const id = Math.random();
      setSparks((s) => [
        ...s,
        { id, x: x ?? 60 + Math.random() * 120, y: y ?? 0, amt: rate },
      ]);
      setTimeout(() => setSparks((s) => s.filter((k) => k.id !== id)), 1000);
      FBLog.event("tx-mined", { kind, rate });
    }, []);

    // ---- dog mode engine ----
    const dog = useDogMode(isDog && !!profile && !cooling, {
      onTreat: () => {
        const treat = Math.round(ICICLE_BASE * 3 * (1 + chaosStreak * 0.1));
        setIcicles((v) => v + treat);
        setFetches((f) => f + 1);
        setXp((v) => v + 20);
        mineDiesel("fetch");
        FBLog.event("fetch", { treat });
        setToast({ msg: `▸ FETCHED! +${treat} ICICLES`, kind: "" });
      },
    });

    // body class per mode
    useEffect(() => {
      const all = MODE_KEYS.map((k) => MODES[k].body).filter(Boolean);
      all.forEach((c) => document.body.classList.remove(c));
      const cls = MODES[mode] && MODES[mode].body;
      if (cls) document.body.classList.add(cls);
      return () => all.forEach((c) => document.body.classList.remove(c));
    }, [mode]);

    useEffect(() => {
      document.documentElement.style.setProperty(
        "--crt-intensity",
        String(tweaks.crt),
      );
    }, [tweaks.crt]);

    // splash keyboard
    useEffect(() => {
      return undefined;
    }, [showSplash]);

    // ---- block clock ----
    // when a real alkanesjs provider is connected, espo's indexed height wins
    useEffect(() => {
      if (!CH.live) return;
      setHeight(CH.height);
    }, [CH.live, CH.height]);

    useEffect(() => {
      if (CH.live) return; // real blocks arrive from the chain, not a timer
      if (cine || showSplash || showWallet || !profile) return;
      const ms = tweaks.blockSec * 1000;
      const t0 = performance.now();
      let raf;
      (function tick(now) {
        setProgress((((now || performance.now()) - t0) % ms) / ms);
        raf = requestAnimationFrame(tick);
      })();
      const iv = setInterval(advanceBlock, ms);
      return () => {
        cancelAnimationFrame(raf);
        clearInterval(iv);
      };
    }, [tweaks.blockSec, cine, showSplash, showWallet, profile]);

    const warned = useRef(0);
    useEffect(() => {
      if (progress > 0.82 && progress < 0.9 && warned.current !== height) {
        warned.current = height;
        AU.play("approach");
      }
    }, [progress, height]);

    useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(null), 2400);
      return () => clearTimeout(t);
    }, [toast]);
    useEffect(() => {
      if (!bubble) return;
      const t = setTimeout(() => setBubble(null), 3200);
      return () => clearTimeout(t);
    }, [bubble]);

    // ---- live play: score / bust / clear ----
    const boardScore = useCallback((bIx, n) => {
      if (R.current.cooling) return;
      setSession((prev) =>
        prev.map((b, i) =>
          i === bIx && !b.revealed && !b.run.busted
            ? { ...b, run: { ...b.run, score: b.run.score + n, started: true } }
            : b,
        ),
      );
      mineDiesel("play");
      AU.play(n >= 8 ? "jackpot" : n >= 3 ? "coin" : "pick");
      mark("firstPick");
      if (R.current.isDog && Math.random() > 0.75) dog.pushBark();
    }, []);

    const boardBust = useCallback((bIx) => {
      setSession((prev) =>
        prev.map((b, i) =>
          i === bIx && !b.revealed && !b.run.busted
            ? {
                ...b,
                run: { ...b.run, busted: true, started: true },
                flash: "bust",
              }
            : b,
        ),
      );
      AU.play("bust");
      setWinStreak(0);
      mark("firstBust");
      FBLog.event("run-bust", { board: bIx });
      setTimeout(
        () =>
          setSession((prev) =>
            prev.map((b, i) => (i === bIx ? { ...b, flash: null } : b)),
          ),
        900,
      );
    }, []);

    const boardDone = useCallback((bIx) => {
      setSession((prev) =>
        prev.map((b, i) =>
          i === bIx && !b.revealed
            ? {
                ...b,
                run: { ...b.run, done: true, started: true },
                flash: "win",
              }
            : b,
        ),
      );
      AU.play("correct");
      setTimeout(
        () =>
          setSession((prev) =>
            prev.map((b, i) => (i === bIx ? { ...b, flash: null } : b)),
          ),
        900,
      );
    }, []);

    function swapGame(bIx, key) {
      setSession((prev) =>
        prev.map((b, i) =>
          i === bIx && !b.revealed
            ? buildBoardForGame(
                key,
                b.seed,
                R.current.tweaks.mines,
                R.current.mode,
              )
            : b,
        ),
      );
      mineDiesel("swap");
      setToast({ msg: `BOARD ${bIx + 1} ▸ ${GAMES9[key].name}`, kind: "" });
      AU.play("open");
      setPickerFor(null);
    }
    function loadToQueue(key) {
      const s = R.current.session,
        c = R.current.currentIx;
      const ix = s.findIndex(
        (b, i) => i >= c && !b.revealed && b.gameKey !== key,
      );
      if (ix === -1) {
        setToast({ msg: "QUEUE FULL OF " + GAMES9[key].name, kind: "" });
        return;
      }
      swapGame(ix, key);
    }

    // ---- block advance ----
    function advanceBlock() {
      setHeight((h) => h + 1);
      setBlocksSeen((b) => b + 1);
      AU.play("block");

      // cooldown ticking
      if (R.current.cooling) {
        setCooldownLeft((c) => {
          if (c <= 1) {
            setCooling(false);
            setBlocksUsed(0);
            setToast({ msg: "▸ SESSION REOPENED", kind: "mint" });
            if (R.current.mode === "diesel")
              setBadges((b) => (b.includes("grass") ? b : [...b, "grass"]));
            return 0;
          }
          return c - 1;
        });
        return;
      }

      // consume budget
      setBlocksUsed((u) => {
        const n = u + 1;
        if (n >= R.current.budgetMax) {
          setCooling(true);
          setCooldownLeft(R.current.coolMax);
          setToast({
            msg: `▸ ${MODES[R.current.mode].cooldownName}`,
            kind: "hot",
          });
        }
        return n;
      });

      const idx = R.current.currentIx,
        sess = R.current.session,
        tw = R.current.tweaks,
        dg = R.current.isDog;
      const modeCfgNow = MODES[R.current.mode] || MODES.human;
      if (idx >= 4) {
        setSession(freshSession(Date.now(), tw.mines, R.current.mode));
        setCurrentIx(0);
        setToast({ msg: "▸ NEW ROUND · 4 FRESH BOARDS", kind: "" });
        setDaysPlayed((d) => d + 1);
        return;
      }

      const cur = sess[idx];
      const run = cur.run || {
        score: 0,
        busted: false,
        done: false,
        started: false,
      };
      const hit = run.busted;
      const played = run.started && run.score > 0;
      const chaos = dg ? 1 + R.current.chaosStreak * 0.15 : 1;
      const clearBonus = run.done ? 1.5 : 1;
      const gained = !played
        ? 0
        : hit
          ? 0
          : Math.round(
              run.score *
                ICICLE_BASE *
                0.55 *
                chaos *
                clearBonus *
                modeCfgNow.payMult,
            );

      setSession((prev) =>
        prev.map((b, i) =>
          i === idx
            ? {
                ...b,
                revealed: true,
                status: !played ? "skip" : hit ? "bust" : "won",
                payout: gained,
                icicles: gained,
                flash: !played ? null : hit ? "bust" : "win",
              }
            : b,
        ),
      );
      setTimeout(
        () =>
          setSession((prev) =>
            prev.map((b, i) => (i === idx ? { ...b, flash: null } : b)),
          ),
        1000,
      );

      AU.play("defrost");
      if (played) {
        setGamesPlayed((g) => g + 1);
        mineDiesel("reveal");
      }

      if (!played) {
        setToast({ msg: `BOARD ${idx + 1} ▸ SKIPPED`, kind: "" });
        setBubble("you forgot board " + (idx + 1) + "!");
      } else if (hit) {
        setChaosStreak(0);
        FBLog.event("board-bust", {
          board: idx,
          game: cur.gameKey,
          score: run.score,
        });
        mark("firstBust");
        AU.play("lose");
        setWinStreak(0);
        setToast({
          msg: `BOARD ${idx + 1} ▸ MINE STRUCK · BUSTED`,
          kind: "hot",
        });
        setBubble(
          isDog
            ? "the pack has bitten a mine. again."
            : "ouch. that one was cold.",
        );
        setMood("sad");
        if (isDog) setTroops((t) => Math.max(1, t - 2));
      } else {
        setIcicles((v) => v + gained);
        setGamesWon((g) => g + 1);
        setXp((v) => v + 15);
        FBLog.event("board-win", {
          board: idx,
          game: cur.gameKey,
          score: run.score,
          gained,
        });
        mark("firstWin");
        setChaosStreak((s) => s + Math.ceil(run.score / 3));
        if (isDog) {
          setTroops((t) => t + 2);
          dog.pushBark("HECKIN WIN!");
        }
        // streak + confetti + shareable card
        const st = R.current.winStreak + 1;
        setWinStreak(st);
        setConfetti({ fire: Date.now(), streak: st });
        AU.play(st >= 3 ? "jackpot" : "win");
        if (st >= 3) setTimeout(() => AU.play("heat"), 420);
        const g9 = GAMES9[cur.gameKey] || GAMES9.sats;
        const card = {
          id: "FB-" + Date.now().toString(36).slice(-5).toUpperCase(),
          seed: (cur.seed || Date.now()) >>> 0,
          icicles: gained,
          game: g9.name,
          color: g9.color,
          height: R.current.height + 1,
          handle: (profile && profile.handle) || "PLAYER",
          streak: st,
          mult: "×" + (run.score * 0.55 * clearBonus).toFixed(2),
        };
        setCards((c) => [card, ...c].slice(0, 24));
        setCardToast(card);
        setTimeout(() => setCardToast(null), 5200);
        setToast({
          msg: `BOARD ${idx + 1} ▸ +${gained} ICICLES${run.done ? " · CLEARED ×1.5" : ""}`,
          kind: "mint",
        });
        setBubble("freezing! +" + gained + " icicles");
        setMood("cheer");
        setBadges((b) => (b.includes("firstblood") ? b : [...b, "firstblood"]));
      }
      setTimeout(() => setMood("idle"), 1800);
      setCurrentIx(idx + 1);
    }

    // ---- badge checks ----
    useEffect(() => {
      setBadges((b) => {
        const n = new Set(b);
        if (diesel >= 100) n.add("diesel100");
        if (glacierTier >= 1) n.add("shelf");
        if (glacierTier >= 3) n.add("titan");
        if (troops >= 21) n.add("dogarmy");
        if (fetches >= 10) n.add("fetch");
        if (Math.floor(xp / XP_PER_LEVEL) + 1 >= 9) n.add("wizard");
        if (glacierTokens > 0) n.add("cashout");
        if (session.filter((s) => s.status === "won").length === 4)
          n.add("sweep");
        return n.size === b.length ? b : [...n];
      });
    }, [diesel, glacierTier, troops, fetches, xp, glacierTokens, session]);

    // dev hooks
    useEffect(() => {
      window.__frostbite_reset = () => {
        setSession(
          freshSession(Date.now(), R.current.tweaks.mines, R.current.mode),
        );
        setCurrentIx(0);
        setToast({ msg: "▸ SESSION RESET", kind: "" });
      };
      window.__frostbite_advance = () => advanceBlock();
      window.__frostbite_sheet = (name) => setSheet(name);
    }, []);

    useEffect(() => {
      setSession((prev) =>
        prev.map((b) =>
          b.revealed || b.picks.length
            ? b
            : buildBoardForGame(b.gameKey, b.seed, tweaks.mines, mode),
        ),
      );
    }, [tweaks.mines, mode]);

    // ---- unlocks ----
    // 0/0 is 0%, not NaN and not a seeded value. This is also the number the KOTS
    // gate reads, so it must never be fabricated.
    const winRate = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;
    const kotsOpen = tweaks.unlockAll || (gamesPlayed >= 10 && winRate >= 0.3);
    const szOpen = tweaks.unlockAll || daysPlayed >= 30;
    const playShare = Math.min(0.05, txCount / 20000);
    const pendingIcicles = session.reduce(
      (s, b) => s + (b.status === "won" ? b.icicles : 0),
      0,
    );

    function buildGlacier(tier) {
      const t = TIERS[tier - 1];
      if (icicles < t.cost) return;
      setIcicles((v) => v - t.cost);
      setGlacierTier(tier);
      mineDiesel("glacier");
      FBLog.event("glacier-built", { tier, name: t.name, cost: t.cost });
      mark("firstGlacier");
      setToast({ msg: `▸ ${t.name} ERECTED · ${t.mult}× BONUS`, kind: "mint" });
      setBubble(`${t.name} rising!`);
    }

    function doBurn(b, payload) {
      if (b.cost.icicles) setIcicles((v) => Math.max(0, v - b.cost.icicles));
      if (b.cost.glacier)
        setGlacierTokens((v) => Math.max(0, v - b.cost.glacier));
      AU.play("heat");
      setXp((v) => v + 40);
      mineDiesel("burn");
      if (b.id === "reroll") {
        setSession(
          freshSession(Date.now(), R.current.tweaks.mines, R.current.mode),
        );
        setCurrentIx(0);
      }
      if (b.id === "stakes") setStakesUp(true);
      if (b.id === "forge") setRelics((v) => v + 1);
      if (b.id === "thaw") {
        setSession((prev) =>
          prev.map((x, i) =>
            i === R.current.currentIx && !x.revealed
              ? { ...x, run: { ...(x.run || {}), busted: false } }
              : x,
          ),
        );
      }
      setToast({ msg: "▸ BURNED · " + b.name, kind: "mint" });
    }

    function doCashout({ glacier, diesel: d }) {
      setGlacierTokens((v) => v + glacier);
      setIcicles(0);
      setDiesel(0);
      mineDiesel("cashout");
      FBLog.event("cashout", { glacier, diesel: d, tier: glacierTier });
      mark("firstCashout");
      setXp((v) => v + 60);
      setToast({
        msg: `▸ CASHED OUT · +${glacier.toFixed(2)} GLACIER`,
        kind: "mint",
      });
    }

    // All four boards are playable at once. That is the premise: you are predicting
    // four blocks ahead, and a board settles when its block lands. Nothing gates the
    // queue behind the live board — only a revealed board is closed.
    function gateFor() {
      return false;
    }

    function tierFor(i) {
      if (session[i] && session[i].revealed) return "dead";
      const o = i - currentIx;
      return o === 0
        ? "now"
        : o === 1
          ? "next"
          : o === 2
            ? "3"
            : o === 3
              ? "4"
              : "dead";
    }

    const VENUES = [
      { k: "arcade", n: "THE ARCADE", s: "4 boards · 9 cabinets", open: true },
      {
        k: "kots",
        n: "KING OF THE SAT",
        s: kotsOpen
          ? "free-for-all · live"
          : `win 30% · ${(winRate * 100).toFixed(0)}%`,
        open: kotsOpen,
        prog: Math.min(1, winRate / 0.3),
      },
      {
        k: "subzero",
        n: "SUBZERO CORE",
        s: szOpen
          ? `4 worlds · ${11 - subzeroPlays} plays left`
          : `${daysPlayed}/30 days played`,
        open: szOpen,
        prog: Math.min(1, daysPlayed / 30),
      },
      {
        k: "crew",
        n: "THE CREW",
        s: (CREW.find((c) => c.id === crewId) || {}).name || "pick a captain",
        open: true,
      },
      {
        k: "minercraft",
        n: "MINERCRAFT",
        s: "forge · audit · graduate",
        open: true,
      },
      {
        k: "fortress",
        n: "THE FORTRESS",
        s: "security posture · live",
        open: true,
      },
      { k: "burn", n: "THE FURNACE", s: "burn · vote · level up", open: true },
      {
        k: "vault",
        n: "THE VAULT",
        s: "icicles · glaciers · badges",
        open: true,
      },
    ];

    return (
      <div
        className={
          "app " +
          (tweaks.crt > 0.01 ? "crt" : "") +
          (showCashout ? " cash-open" : "")
        }
      >
        {tweaks.snow && mode !== "fire" && mode !== "cheese" && <Snowfall />}
        <ModeAmbience mode={mode} />
        {cine && (
          <Cinematic
            AU={AU}
            selected={crewId}
            onOperator={(id) => {
              setCrewId(id);
              AU.play("levelup");
            }}
            onDone={() => {
              setCine(false);
              setShowSplash(false);
              setShowWallet(true);
            }}
          />
        )}
        {showWallet && (
          <WalletFlow
            onDone={(p) => {
              setProfile(p);
              setMode(p.mode);
              setShowWallet(false);
              FBLog.event("wallet-connected", {
                wallet: p.wallet,
                mode: p.mode,
                funded: p.funded,
              });
              setToast({ msg: `▸ WELCOME ${p.handle}`, kind: "" });
              setTimeout(() => setShowWalk(true), 700);
            }}
          />
        )}
        {showCashout && (
          <CashoutModal
            icicles={icicles}
            glacierTier={glacierTier}
            diesel={diesel}
            dieselPot={DIESEL_POT}
            playShare={playShare}
            houseCut={tweaks.houseCut}
            badges={badges.length}
            onClose={() => setShowCashout(false)}
            onCashout={doCashout}
          />
        )}
        {cooling && (
          <ModeCooldown
            remaining={cooldownLeft}
            total={coolMax}
            mode={mode}
            played={budgetMax}
          />
        )}

        {!showSplash && !showWallet && profile && (
          <div className="shell">
            <Hud
              user={profile.handle}
              balance={{ usd: 21 }}
              fuel={icicles}
              dxbtc={glacierTokens}
              height={height}
              onWallet={() => setShowCashout(true)}
              onSettings={() => {
                window.parent.postMessage(
                  { type: "__edit_mode_available" },
                  "*",
                );
                window.parent.postMessage(
                  { type: "__activate_edit_mode" },
                  "*",
                );
              }}
            />

            <div style={{ marginTop: 14 }}>
              <Marquee height={height} />
            </div>

            {/* diesel rail — always visible, always mining */}
            <div style={{ position: "relative" }}>
              <DieselRail
                diesel={diesel}
                txCount={txCount}
                striking={striking}
                mode={mode}
              />
              {sparks.map((s) => (
                <span
                  key={s.id}
                  className="spark"
                  style={{ left: s.x, top: 8 }}
                >
                  +{s.amt.toFixed(4)} ⛏
                </span>
              ))}
            </div>

            {/* mode + budget */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <BlockBudget
                mode={mode}
                onMode={(m) => {
                  setMode(m);
                  setBlocksUsed(0);
                  setCooling(false);
                  setSession(
                    freshSession(Date.now(), R.current.tweaks.mines, m),
                  );
                  setCurrentIx(0);
                  FBLog.event("mode-switch", { to: m });
                  setToast({
                    msg: `▸ ${MODES[m].label} MODE · ${MODES[m].blurb}`,
                    kind: "",
                  });
                }}
                used={blocksUsed}
                cooling={cooling}
                max={budgetMax}
                coolMax={coolMax}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <PopHint mode={mode} />
                <button
                  className="btn sm mag"
                  onClick={() => setShowCashout(true)}
                >
                  ◆ CASH OUT
                </button>
              </div>
            </div>

            {/* venue nav */}
            <div className="venue-nav">
              {VENUES.map((v) => (
                <button
                  key={v.k}
                  className={"venue-tab" + (v.open ? "" : " locked")}
                  data-active={venue === v.k ? "1" : undefined}
                  onClick={() => {
                    if (v.open) {
                      setVenue(v.k);
                      AU.play("click");
                      FBLog.event("venue", { to: v.k });
                    }
                  }}
                >
                  {!v.open && <span className="vt-lock">🔒</span>}
                  <span>{v.n}</span>
                  <span className="vt-sub">{v.s}</span>
                  {v.prog !== undefined && !v.open && (
                    <span className="vt-prog">
                      <i style={{ width: v.prog * 100 + "%" }} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ============ ARCADE ============ */}
            {venue === "arcade" && (
              <div className="venue-body">
                <BlockClock
                  height={height}
                  progress={progress}
                  etaSec={tweaks.blockSec * (1 - progress)}
                  mempoolSat={42 + Math.floor((progress * 17) % 12)}
                  fastSim={tweaks.blockSec <= 60}
                />
                {isDog && (
                  <ChaosMeter
                    chaos={1 + chaosStreak * 0.15}
                    streak={chaosStreak}
                  />
                )}

                <div
                  className={
                    "layout" +
                    (railL ? "" : " railL-closed") +
                    (railR ? "" : " railR-closed")
                  }
                  style={{ marginTop: 6 }}
                >
                  {/* LEFT RAIL */}
                  <div className={"rail" + (railL ? "" : " closed")}>
                    <button
                      className="rail-tab"
                      onClick={() => {
                        setRailL(!railL);
                        AU.play("click");
                      }}
                    >
                      {railL ? "◂ VAULT" : "VAULT ▸"}
                    </button>
                    <div className="rail-scroll">
                      <VaultPanel
                        icicles={icicles}
                        diesel={diesel}
                        glacierTokens={glacierTokens}
                        txCount={txCount}
                        glacierTier={glacierTier}
                        onBuild={buildGlacier}
                        xp={xp}
                        badges={badges}
                        playShare={playShare}
                      />
                    </div>
                  </div>

                  {/* BOARDS */}
                  <div className="board-col">
                    <div className="mega">
                      {session.map((b, i) => (
                        <Board
                          key={i}
                          board={b}
                          ix={i}
                          tier={tierFor(i)}
                          locked={tierFor(i) === "dead" || cooling}
                          gated={gateFor(i)}
                          gateOn={currentIx}
                          onScore={(n) => boardScore(i, n)}
                          onBust={() => boardBust(i)}
                          onRunDone={() => boardDone(i)}
                          onSwap={(ix) => {
                            setPickerFor(ix);
                            AU.play("open");
                          }}
                        />
                      ))}
                    </div>
                    <div className="action-row">
                      <button
                        className="btn ghost"
                        onClick={() => window.__frostbite_reset()}
                      >
                        ↻ ROUND
                      </button>
                      <button
                        className="btn"
                        onClick={() => window.__frostbite_advance()}
                      >
                        ▸ NEXT BLOCK
                      </button>
                      <button
                        className="btn mag"
                        onClick={() => setShowCashout(true)}
                        disabled={icicles === 0}
                      >
                        ◆ CASH OUT{" "}
                        {icicles > 0 ? `(${icicles.toLocaleString()})` : ""}
                      </button>
                      <span className="divider" />
                      {[
                        ["arcade", "◈", "ARCADE", 9],
                        ["crew", "☻", "CREW", 8],
                        ["venues", "❖", "VENUES", VENUES.length],
                      ].map(([k, ico, lab, n]) => (
                        <button
                          key={k}
                          className="sheet-btn"
                          data-on={sheet === k ? "1" : undefined}
                          onClick={() => {
                            setSheet(sheet === k ? null : k);
                            AU.play(sheet === k ? "close" : "open");
                          }}
                        >
                          <i>{ico}</i>
                          {lab}
                          <span className="sb-count">{n}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT RAIL */}
                  <div className={"rail" + (railR ? "" : " closed")}>
                    <button
                      className="rail-tab"
                      onClick={() => {
                        setRailR(!railR);
                        AU.play("click");
                      }}
                    >
                      {railR ? "LEDGER ▸" : "◂ LEDGER"}
                    </button>
                    <div className="rail-scroll">
                      <div className="panel">
                        <div className="panel-head tight">▸ round ledger</div>
                        <div
                          className="panel-body"
                          style={{ padding: "8px 11px" }}
                        >
                          <div className="kv">
                            <span className="k">boards live</span>
                            <span className="v">
                              {session.filter((b) => !b.revealed).length}/4
                            </span>
                          </div>
                          <div className="kv">
                            <span className="k">won</span>
                            <span
                              className="v"
                              style={{ color: "var(--mint)" }}
                            >
                              {session.filter((b) => b.status === "won").length}
                            </span>
                          </div>
                          <div className="kv">
                            <span className="k">busted</span>
                            <span className="v" style={{ color: "var(--hot)" }}>
                              {
                                session.filter((b) => b.status === "bust")
                                  .length
                              }
                            </span>
                          </div>
                          <div className="kv">
                            <span className="k">round icicles</span>
                            <span
                              className="v frost"
                              style={{ color: "var(--frost)" }}
                            >
                              {pendingIcicles}
                            </span>
                          </div>
                          <div className="kv">
                            <span className="k">win rate</span>
                            <span className="v">
                              {(winRate * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="kv">
                            <span className="k">streak</span>
                            <span
                              className="v"
                              style={{
                                color:
                                  winStreak > 2 ? "var(--hot)" : "var(--paper)",
                              }}
                            >
                              ×{winStreak}
                            </span>
                          </div>
                          {isDog && (
                            <div className="kv">
                              <span className="k">$DOG troops</span>
                              <span
                                className="v gold"
                                style={{ color: "var(--gold)" }}
                              >
                                {troops}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="panel">
                        <div className="panel-head tight">▸ free to play</div>
                        <div
                          className="panel-body"
                          style={{
                            fontFamily: "var(--f-mono)",
                            fontSize: 11,
                            lineHeight: 1.6,
                            color: "var(--silver)",
                          }}
                        >
                          Every tap is a Bitcoin transaction and{" "}
                          <b className="frost">the house signs it</b>, so the
                          house pays the sats. Because it signs, the house{" "}
                          <b className="hot">mines the diesel</b>. You spend
                          nothing to play. Cash out and you cover one mint fee,
                          split <b style={{ color: "var(--mint)" }}>85/15</b>,
                          and take your diesel share with you.
                        </div>
                      </div>
                      <CharSay who={isDog ? "dog" : "miner"}>
                        {isDog
                          ? DOG_LINES[
                              Math.floor(chaosStreak / 3) % DOG_LINES.length
                            ]
                          : "Every tap turns the rig. Diesel doesn't care what you clicked — only that you clicked."}
                      </CharSay>
                      <TransmissionArchive
                        found={sat.found}
                        onOpen={sat.open}
                      />
                      <ChainStatus chain={CH.chain} mode={CH.mode} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ KING OF THE SAT ============ */}
            {venue === "kots" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                {kotsOpen ? (
                  <KingOfTheSat
                    height={height}
                    blockProgress={progress}
                    mode={mode}
                    onMine={mineDiesel}
                    onScore={(pts) => {
                      setIcicles((v) => v + Math.round(pts / 2));
                      setXp((v) => v + 4);
                    }}
                    onBadge={() =>
                      setBadges((b) =>
                        b.includes("kots") ? b : [...b, "kots"],
                      )
                    }
                  />
                ) : (
                  <Gate
                    ic="♛"
                    title="KING OF THE SAT IS SEALED"
                    sub="Win 30% of your mini-games to earn a seat in the free-for-all. James Bond meets capture the flag — and it only runs while the block is unsolved."
                    have={Math.round(winRate * 100)}
                    need={30}
                    unit="% win rate"
                  />
                )}
              </div>
            )}

            {/* ============ SUBZERO CORE ============ */}
            {venue === "subzero" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                {szOpen ? (
                  <>
                    <div className="panel" style={{ marginBottom: 14 }}>
                      <div className="panel-head">
                        <span>
                          ▸ subzero core · the four boards are greyed out while
                          you're inside
                        </span>
                        <span
                          className="ft dim"
                          style={{
                            fontFamily: "var(--f-term)",
                            fontSize: 14,
                            textTransform: "none",
                            letterSpacing: ".02em",
                          }}
                        >
                          11 plays per year · you have {11 - subzeroPlays}
                        </span>
                      </div>
                    </div>
                    <SubzeroCore
                      mode={mode}
                      playsLeft={11 - subzeroPlays}
                      daysLeft={7}
                      onMine={mineDiesel}
                      onSolve={(moves) => {
                        const bonus = Math.round(
                          ICICLE_BASE * 9 * Math.max(1, 3 - moves / 60),
                        );
                        setIcicles((v) => v + bonus);
                        setXp((v) => v + 200);
                        setSubzeroPlays((p) => p + 1);
                        setBadges((b) =>
                          b.includes("subzero") ? b : [...b, "subzero"],
                        );
                        setToast({
                          msg: `▸ CORE BROKEN · +${bonus} ICICLES · 9×`,
                          kind: "mint",
                        });
                      }}
                    />
                  </>
                ) : (
                  <Gate
                    ic="◉"
                    title="SUBZERO CORE IS FROZEN SHUT"
                    sub="Play 30 days to unlock. Then you get a 7-day window on the ice disco ball — spin it, click it, sort and stack it before a rival knocks you off the spot. 11 attempts a year, no more."
                    have={daysPlayed}
                    need={30}
                    unit="days played"
                  />
                )}
              </div>
            )}

            {/* ============ MINERCRAFT ============ */}
            {venue === "minercraft" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                <MinerCraft onMine={mineDiesel} />
              </div>
            )}

            {/* ============ THE CREW ============ */}
            {venue === "crew" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                <CrewSelect
                  selected={crewId}
                  onMine={mineDiesel}
                  onSelect={(id) => {
                    setCrewId(id);
                    FBLog.event("crew-deploy", { crew: id });
                    const c = CREW.find((x) => x.id === id);
                    setToast({ msg: `▸ DEPLOYED · ${c.name}`, kind: "mint" });
                    setBubble(c.perk.split(" · ")[0] + " active");
                  }}
                />
              </div>
            )}

            {/* ============ THE FORTRESS ============ */}
            {venue === "fortress" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                <Fortress />
              </div>
            )}

            {/* ============ THE FURNACE ============ */}
            {venue === "burn" && (
              <div className="venue-pane" style={{ marginTop: 8 }}>
                <BurnVenue
                  icicles={icicles}
                  glacier={glacierTokens}
                  onBurn={doBurn}
                  onMine={mineDiesel}
                />
              </div>
            )}

            {/* ============ VAULT ============ */}
            {venue === "vault" && (
              <div className="venue-pane">
                <div
                  className="layout"
                  style={{ gridTemplateColumns: "1fr 1fr", display: "grid" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <VaultPanel
                      icicles={icicles}
                      diesel={diesel}
                      glacierTokens={glacierTokens}
                      txCount={txCount}
                      glacierTier={glacierTier}
                      onBuild={buildGlacier}
                      xp={xp}
                      badges={badges}
                      playShare={playShare}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div className="panel">
                      <div className="panel-head">▸ your orbital glacier</div>
                      <div
                        className="panel-body"
                        style={{
                          display: "grid",
                          placeItems: "center",
                          padding: 18,
                        }}
                      >
                        {glacierTier >= 1 ? (
                          <>
                            <div
                              className="glacier-frame"
                              style={{
                                width: 250,
                                height: 280,
                                position: "relative",
                              }}
                            >
                              <div className="glacier-mint">
                                <OrbitalGlacier
                                  seed={(txCount + 17) * 31}
                                  size={230}
                                  tier={glacierTier}
                                />
                              </div>
                              <div className="g-id">
                                PREVIEW · {TIERS[glacierTier - 1].name}
                              </div>
                            </div>
                            <div
                              className="ft dim"
                              style={{
                                fontSize: 14,
                                marginTop: 12,
                                textAlign: "center",
                                lineHeight: 1.45,
                              }}
                            >
                              Generative and unique — it's minted from your play
                              history the moment you cash out.
                            </div>
                          </>
                        ) : (
                          <div
                            className="ft dim"
                            style={{
                              fontSize: 16,
                              textAlign: "center",
                              padding: "30px 10px",
                              lineHeight: 1.5,
                            }}
                          >
                            Erect a glacier to preview the orbital you'll mint
                            on cashout.
                          </div>
                        )}
                      </div>
                    </div>
                    <CharSay who="wizard">
                      Icicles are a promise. GLACIER is a fact on Bitcoin. The
                      bridge between them is a signature and fifteen percent — a
                      fair toll for warm hands.
                    </CharSay>
                    <TransmissionArchive found={sat.found} onOpen={sat.open} />
                    <div className="panel">
                      <div className="panel-head">▸ diesel pot</div>
                      <div className="panel-body" style={{ padding: 14 }}>
                        <div className="kv">
                          <span className="k">global pot</span>
                          <span
                            className="v gold"
                            style={{ color: "var(--gold)" }}
                          >
                            {DIESEL_POT.toLocaleString()} DIESEL
                          </span>
                        </div>
                        <div className="kv">
                          <span className="k">your play share</span>
                          <span className="v">
                            {(playShare * 100).toFixed(3)}%
                          </span>
                        </div>
                        <div className="kv">
                          <span className="k">claimable at cashout</span>
                          <span className="v" style={{ color: "var(--hot)" }}>
                            {(DIESEL_POT * playShare).toFixed(4)}
                          </span>
                        </div>
                        <div
                          className="ft dim"
                          style={{
                            fontSize: 13,
                            marginTop: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          The pot grows every time anybody plays, because every
                          play is a transaction and every transaction mines
                          diesel. Your slice scales with how much you play.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {sheet && !showSplash && !showWallet && profile && (
          <>
            <div
              className="sheet-scrim"
              onClick={() => {
                setSheet(null);
                AU.play("close");
              }}
            />
            <div className="sheet">
              <div className="sheet-grip" />
              <div className="sheet-head">
                <div>
                  <div className="sheet-title">
                    {sheet === "arcade"
                      ? "▸ THE ARCADE · 9 CABINETS"
                      : sheet === "crew"
                        ? "▸ THE CREW · SPIN TO DEPLOY"
                        : sheet === "venues"
                          ? "▸ VENUES"
                          : "▸ NOTICES"}
                  </div>
                  <div className="sheet-sub">
                    {sheet === "arcade"
                      ? "click a cabinet to load it into the next free board"
                      : sheet === "crew"
                        ? "drag it · 9 stats each · 3 emotes"
                        : sheet === "venues"
                          ? "nine venues · plus the house notices"
                          : "house slots · no trackers, no third-party scripts"}
                  </div>
                </div>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    setSheet(null);
                    AU.play("close");
                  }}
                >
                  ✕ CLOSE
                </button>
              </div>
              <div className="sheet-body">
                {sheet === "arcade" && (
                  <ArcadeStrip
                    session={session}
                    currentIx={currentIx}
                    onSwap={(k) => {
                      loadToQueue(k);
                    }}
                  />
                )}
                {sheet === "crew" && (
                  <div className="panel crew-deck">
                    <div className="panel-body">
                      <CrewSelect
                        selected={crewId}
                        onMine={mineDiesel}
                        onSelect={(id) => {
                          setCrewId(id);
                          AU.play("levelup");
                          FBLog.event("crew-deploy", { crew: id });
                          const cc = CREW.find((x) => x.id === id);
                          setToast({
                            msg: `▸ DEPLOYED · ${cc.name}`,
                            kind: "mint",
                          });
                        }}
                      />
                      <div className="emote-bar">
                        {[
                          ["giggle", "◕‿◕", "GIGGLE"],
                          ["cry", "╥﹏╥", "CRY"],
                          ["angry", "ಠ益ಠ", "RAGE"],
                        ].map(([k, ico, lab]) => (
                          <button
                            key={k}
                            className="emote-btn"
                            data-k={k}
                            data-on={forceMood === k ? "1" : undefined}
                            onClick={() => {
                              setForceMood(k);
                              AU.play(
                                k === "angry"
                                  ? "bark"
                                  : k === "cry"
                                    ? "lose"
                                    : "correct",
                              );
                              setTimeout(() => setForceMood(null), 2800);
                            }}
                          >
                            <i>{ico}</i>
                            <span>{lab}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {(sheet === "venues" || sheet === "ads") && (
                  <div className="venue-sheet">
                    {VENUES.map((v) => (
                      <button
                        key={v.k}
                        className="vs-item"
                        data-on={venue === v.k ? "1" : undefined}
                        disabled={!v.open}
                        onClick={() => {
                          if (v.open) {
                            setVenue(v.k);
                            setSheet(null);
                            AU.play("click");
                          }
                        }}
                      >
                        <b>{v.n}</b>
                        <span>{v.s}</span>
                        {!v.open && <i>LOCKED</i>}
                      </button>
                    ))}
                    <div className="vs-ads">
                      {[0, 1, 2].map((s) => (
                        <AdSlot
                          key={s}
                          slot={s}
                          onMine={mineDiesel}
                          onGo={(to) => {
                            if (to) {
                              setVenue(to);
                              setSheet(null);
                              AU.play("open");
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {pickerFor !== null && (
          <GamePicker
            boardIx={pickerFor}
            onPick={(k) => swapGame(pickerFor, k)}
            onClose={() => setPickerFor(null)}
          />
        )}

        {isDog && <FetchBone bone={dog.bone} onFetch={dog.fetchBone} />}
        {isDog && <Barks barks={dog.barks} />}

        {sat.openIx !== null && TRANSMISSIONS[sat.openIx] && (
          <Transmission
            tx={TRANSMISSIONS[sat.openIx]}
            index={sat.openIx}
            total={TRANSMISSIONS.length}
            onClose={sat.close}
            onNext={sat.next}
          />
        )}
        {showWalk && (
          <Walkthrough
            onClose={() => setShowWalk(false)}
            onVenue={(v) => setVenue(v)}
            onDone={() => {
              FBLog.event("tutorial-complete");
              setToast({ msg: "▸ WALKTHROUGH COMPLETE", kind: "mint" });
            }}
          />
        )}
        {showBug && (
          <BugReporter ctx={ctxSnapshot()} onClose={() => setShowBug(false)} />
        )}
        <FaultPopups />

        {confetti && (
          <ConfettiBurst
            fire={confetti.fire}
            streak={confetti.streak}
            onDone={() => setConfetti(null)}
          />
        )}
        {winStreak > 0 && confetti && <StreakBanner streak={winStreak} />}
        {cardToast && !bagOpen && (
          <WinCardToast
            card={cardToast}
            onOpen={() => {
              setBagOpen(true);
              setSeenCards(cards.length);
              setCardToast(null);
              AU.play("open");
            }}
          />
        )}

        {!showSplash && !showWallet && profile && (
          <>
            <PopLayer pop={POP.pop} floats={POP.floats} onGrab={POP.grab} />
            <div className="railstack">
              <div
                className="cashtab"
                data-ready={icicles >= 300 ? "1" : undefined}
                style={{ "--fill": Math.min(1, icicles / 1000) }}
              >
                <button
                  className="ct-tab"
                  onClick={() => {
                    setShowCashout(true);
                    AU.play("open");
                  }}
                  title={
                    icicles > 0
                      ? "cash out " + Math.round(icicles) + " icicles"
                      : "nothing to cash out yet"
                  }
                >
                  <span className="ct-fill" />
                  <span className="ct-ico">◆</span>
                  <span className="ct-amt">
                    {icicles >= 1000
                      ? (icicles / 1000).toFixed(1) + "k"
                      : Math.round(icicles)}
                  </span>
                  <span className="ct-lbl">CASH OUT</span>
                </button>
              </div>
              <Jukebox
                A={AU}
                open={jukeOpen}
                onToggle={() => {
                  setJukeOpen(!jukeOpen);
                }}
              />
              <SatBag
                cards={cards}
                open={bagOpen}
                unseen={Math.max(0, cards.length - seenCards)}
                onToggle={() => {
                  const n = !bagOpen;
                  setBagOpen(n);
                  if (n) setSeenCards(cards.length);
                  AU.play(n ? "open" : "close");
                }}
                icicles={icicles}
                diesel={diesel}
                glacierTier={glacierTier}
                sfx={AU.play}
                onCashout={() => {
                  setShowCashout(true);
                  AU.play("open");
                }}
              />
            </div>
          </>
        )}

        {!showSplash && !showWallet && profile && (
          <>
            <button
              className="help-btn"
              title="interactive walkthrough"
              onClick={() => {
                setShowWalk(true);
                FBLog.event("tutorial-open");
              }}
            >
              ?
            </button>
            <button
              className="bug-btn"
              title="report a bug"
              onClick={() => setShowBug(true)}
            >
              ☷
            </button>
          </>
        )}

        {toast && (
          <div className={"toast " + (toast.kind || "")}>{toast.msg}</div>
        )}
        {tweaks.mascot && !showSplash && !showWallet && profile && (
          <Companion
            crewId={crewId}
            venue={venue}
            gameMood={
              forceMood ||
              (mood === "cheer" ? "cheer" : mood === "sad" ? "cry" : null)
            }
            picksOnLive={
              (session[currentIx] && session[currentIx].picks.length) || 0
            }
            mult={multiplierFor(
              (session[currentIx] && session[currentIx].picks.length) || 0,
            ).toFixed(2)}
            emptyBoards={
              session.filter((b) => !b.revealed && b.picks.length === 0).length
            }
            icicles={icicles}
            glacierTier={glacierTier}
            mode={mode}
            onTap={(m, say) => {
              if (say)
                setToast({
                  msg: say.toUpperCase().slice(0, 46),
                  kind: m === "angry" ? "hot" : m === "cry" ? "" : "mint",
                });
            }}
          />
        )}

        <TweaksPanel title="Tweaks">
          <FrostbiteTweaks tweaks={tweaks} setTweak={setTweak} />
        </TweaksPanel>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <FBBoundary>
      <App />
    </FBBoundary>,
  );
})();
