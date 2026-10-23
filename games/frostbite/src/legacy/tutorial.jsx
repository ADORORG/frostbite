// FROST-BITE :: interactive walkthrough — spotlight coach that waits for real actions
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  // step.on: "next" = button advances · "click" = advances when the target is clicked
  // step.go: venue to switch to before showing
  const CHAPTERS = [
    {
      id: "basics",
      name: "THE BASICS",
      who: "wizard",
      color: "#5df6ff",
      steps: [
        {
          sel: ".mega",
          on: "next",
          t: "Four boards. Four blocks.",
          b: "This is the whole game in one frame. Each board reveals on a different Bitcoin block — board 01 on the next block, board 02 the one after, and so on. You can fill in all four right now.",
        },
        {
          sel: '.board[data-tier="now"]',
          on: "next",
          t: "The bright one is next to defrost.",
          b: "Brightest = revealing on the next block. The others dim by queue position, and the last one looks almost frozen solid. That glow IS the timer.",
        },
        {
          sel: '.board[data-tier="now"] .play-surface',
          on: "click",
          t: "This one's a real game. Play it.",
          b: "No picking squares — you actually play. Tap, or use WASD, depending on the cabinet. Every board sits FROZEN until you touch it, so nothing runs away from you. Go on — engage this one.",
          wait: "waiting for you to start playing…",
        },
        {
          sel: '.board[data-tier="now"]',
          on: "next",
          t: "Your score banks until the block lands.",
          b: "Points accrue as you play and this readout shows what they're worth. Clear a cabinet outright for ×1.5 on the whole run. Hit a hazard and the board busts to zero — so knowing when to stop is the game.",
        },
        {
          sel: ".block-clock",
          on: "next",
          t: "This is the only clock that matters.",
          b: "When the bar fills, a block lands and the current board defrosts. Ten minutes on mainnet; sped up here so you can actually see it work.",
        },
        {
          sel: ".sheet .arcade-grid",
          on: "next",
          pre: "sheet:arcade",
          t: "Nine cabinets, one rulebook.",
          b: "Minefield, Block Invaders, Frost Crush, Ice-Tris, Plinko, Cryo Wheel, Hash Dice, Penguin Race, Cryo Reels. Same maths, wildly different feel. Click any cabinet to slot it into a free board — or use the ↻ on a board.",
        },
      ],
    },
    {
      id: "economy",
      name: "THE MONEY",
      who: "miner",
      color: "#ff6b35",
      steps: [
        {
          sel: ".hud-stats",
          on: "next",
          t: "Every tap you make mines diesel.",
          b: "Here's the trick that makes this free: every pick is a real Bitcoin transaction, and the HOUSE signs it. The house pays the sats — and because it signs, the house mines the diesel. Your share is credited back at cashout.",
        },
        {
          sel: ".rail .panel",
          on: "next",
          t: "Icicles are in-game. Not yet on chain.",
          b: "Win a board, earn icicles. They're a promise, not a fact — a number in our ledger until you convert them.",
        },
        {
          sel: ".tiers",
          on: "next",
          t: "Build a glacier to multiply your exit.",
          b: "Spend icicles to erect ICE SHELF (3×), BERG (6×) or TITAN SHELF (9×). The bigger the glacier, the more GLACIER tokens your icicles become. Titan also mints you a generative orbital.",
        },
        {
          sel: ".action-row .btn.mag",
          on: "next",
          t: "Cashing out is the one time you pay.",
          b: "Cashout converts icicles → GLACIER alkane tokens, pays your diesel-pot share, takes one small mint fee, and splits 85/15 with the house. That's the entire business model, stated plainly.",
        },
        {
          sel: ".badge-case",
          on: "next",
          t: "Twelve badges. Some are jokes.",
          b: "TOUCHED GRASS is real and you earn it by being told to go outside. Hover any badge to see what unlocks it.",
        },
      ],
    },
    {
      id: "modes",
      name: "THE MODES",
      who: "dog",
      color: "#ffd24a",
      steps: [
        {
          sel: ".mode-pill",
          on: "next",
          t: "Six ways to play. Pick your poison.",
          b: "DIESEL is the core loop — 69 blocks, then you go outside. AGENT gets 42 and 42; declare your bots honestly. $DOG runs 21 with double everything. FIRE pays 2.2×. AIR runs 88 blocks and rests for 11. CHEESE randomises the hazards and offers no explanation.",
        },
        {
          sel: ".budget-bar",
          on: "next",
          t: "The cooldown is not a punishment.",
          b: "It's the whole point. When your budget runs out the arcade closes on you and plays an animation about going outside. Rate-limited by design — for humans AND agents.",
        },
        {
          sel: ".mode-pill button.dog",
          on: "click",
          t: "Try $DOG mode. Tap it.",
          b: "Bones drop at random on your screen — click one within three seconds for a 3× treat. The pack grows when you win and scatters when you bust.",
          wait: "click $DOG to continue…",
        },
      ],
    },
    {
      id: "venues",
      name: "THE VENUES",
      who: "cat",
      color: "#a280ff",
      steps: [
        {
          sel: ".venue-nav",
          on: "next",
          t: "Seven venues. The arcade is just the front door.",
          b: "KING OF THE SAT unlocks at a 30% win rate. SUBZERO CORE unlocks after 30 days. THE CREW is your character roster. MINERCRAFT is where anyone builds a cabinet. THE FORTRESS is our security posture. THE VAULT is your money.",
        },
        {
          sel: ".venue-tab:nth-child(2)",
          on: "next",
          t: "King of the SAT: free-for-all.",
          b: "An 11×11 arena that runs only while the block is unsolved. Capture flags, grab power cores, hold the centre, and knock rivals off their loot. WASD or click to move.",
        },
        {
          sel: ".venue-tab:nth-child(3)",
          on: "next",
          t: "Subzero Core: the mind-bender.",
          b: "A hex-tiled globe across four worlds — Earth, Titus, Frost Mountain, Fire Falls. Drag to spin, click hexes to change terrain, roll whole bands. Get every band to one terrain before a rival scrambles it. 11 attempts a year.",
        },
        {
          sel: ".venue-tab:nth-child(4)",
          on: "next",
          t: "The Crew: eight characters, nine stats.",
          b: "A 3D spin cycle of captains — the Alkane Captain, Mr. Frost, Lt. Danni Diesel and five more. Each carries a perk that actually changes play: Danni mines 25% more diesel, Mr. Frost shaves 3% off the house cut.",
        },
        {
          sel: ".venue-tab:nth-child(5)",
          on: "next",
          t: "MinerCraft: build your own cabinet.",
          b: "Anyone can forge a game. Nobody skips the gauntlet: four security audits, then 30 straight days averaging 21+ players. Graduate and you take 5% of your cabinet's rake forever.",
        },
      ],
    },
    {
      id: "safety",
      name: "THE FORTRESS",
      who: "captain",
      color: "#8effff",
      steps: [
        {
          sel: ".venue-tab:nth-child(6)",
          on: "next",
          t: "You can audit us from inside the game.",
          b: "The Fortress venue publishes our security posture live: tier, gate status, red lines, invariants, attacker-cost maths. If a red line ever goes amber, you'll see it before we announce it.",
        },
        {
          sel: ".hud",
          on: "next",
          t: "Never blind-sign. Not even for us.",
          b: "Every signature request shows you exactly what it grants and what it denies. Our session key can broadcast your picks and nothing else — it cannot spend your UTXOs. Verify that claim in the Fortress.",
        },
        {
          sel: ".bug-btn",
          on: "next",
          t: "Found something broken? Tell us.",
          b: "The bug button files a report with an ID and attaches your whole session. Crashes and errors do it automatically. It all lands in one admin panel, which is how this gets better.",
        },
      ],
    },
  ];

  const TOTAL = CHAPTERS.reduce((n, c) => n + c.steps.length, 0);

  function flatten() {
    const out = [];
    CHAPTERS.forEach((c, ci) =>
      c.steps.forEach((s, si) => out.push({ ...s, ch: ci, si, chapter: c })),
    );
    return out;
  }
  const FLAT = flatten();

  function Walkthrough({ onClose, onVenue, onDone }) {
    const [i, setI] = useState(0);
    const [rect, setRect] = useState(null);
    const [satisfied, setSatisfied] = useState(false);
    const step = FLAT[i];
    const targetRef = useRef(null);
    const tipRef = useRef(null);
    const [tipH, setTipH] = useState(250);
    useEffect(() => {
      const el = tipRef.current;
      if (!el) return;
      const measure = () => setTipH(el.offsetHeight || 250);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }, [i]);

    // the walkthrough narrates the arcade — make sure we're standing in it
    useEffect(() => {
      onVenue && onVenue("arcade");
    }, []);
    useEffect(() => {
      if (step.go && onVenue) onVenue(step.go);
    }, [i, step.go]);

    // Bring the target into view. The page itself no longer scrolls in the fixed-viewport
    // shell — content lives in .rail-scroll / .venue-pane / .sheet-body — so walk up to the
    // nearest scrollable ancestor and move THAT. Timers, not rAF: rAF is throttled to zero
    // in a hidden tab and the retry would never fire.
    useEffect(() => {
      let timers = [],
        pass = 0;
      function scrollable(el) {
        let n = el.parentElement;
        while (n && n !== document.body && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (
            /(auto|scroll)/.test(cs.overflowY) &&
            n.scrollHeight > n.clientHeight + 4
          )
            return n;
          n = n.parentElement;
        }
        return null;
      }
      function bring() {
        const el = document.querySelector(step.sel);
        if (!el) {
          if (pass++ < 30) timers.push(setTimeout(bring, 60));
          return;
        }

        const box = scrollable(el);
        if (box) {
          // scroll within the container
          const br = box.getBoundingClientRect(),
            er = el.getBoundingClientRect();
          const tall = er.height > br.height - 60;
          const margin = 14;
          const delta = tall
            ? er.top - br.top - margin
            : er.top - br.top - (br.height / 2 - er.height / 2);
          const want = Math.max(
            0,
            Math.min(
              box.scrollTop + delta,
              box.scrollHeight - box.clientHeight,
            ),
          );
          if (Math.abs(want - box.scrollTop) > 4) box.scrollTop = want;
        }

        // then the window, if it can move at all
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const docH = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        if (docH > vh + 4) {
          const tall = r.height > vh - 200;
          let want = tall
            ? window.scrollY + r.top - 88
            : window.scrollY + r.top + r.height / 2 - vh / 2;
          want = Math.max(0, Math.min(want, docH - vh));
          if (Math.abs(want - window.scrollY) > 8) {
            const smooth = !document.hidden && pass === 0;
            window.scrollTo({
              top: want,
              behavior: smooth ? "smooth" : "auto",
            });
            if (smooth)
              timers.push(
                setTimeout(() => {
                  if (Math.abs(want - window.scrollY) > 24)
                    window.scrollTo({ top: want, behavior: "auto" });
                }, 420),
              );
          }
        }
        if (pass++ < 5) timers.push(setTimeout(bring, 170));
      }
      bring();
      return () => timers.forEach(clearTimeout);
    }, [i, step.sel]);

    // a step may need the UI opened first (the arcade grid lives in a closed bottom sheet)
    useEffect(() => {
      if (!step.pre) return;
      const [kind, arg] = step.pre.split(":");
      if (kind === "sheet" && window.__frostbite_sheet)
        window.__frostbite_sheet(arg);
    }, [i, step.pre]);

    // find + track the target element. Polls on a timer (not rAF) so it keeps tracking
    // in a hidden tab or preview pane, where rAF is throttled to zero.
    useEffect(() => {
      setSatisfied(false);
      setRect(null);
      let tries = 0,
        stop = false;
      function measure() {
        if (stop) return;
        const el = document.querySelector(step.sel);
        targetRef.current = el;
        const r = el && el.getBoundingClientRect();
        const usable = r && r.width > 2 && r.height > 2;
        if (usable) {
          setRect((p) =>
            p &&
            Math.abs(p.top - r.top) < 0.5 &&
            Math.abs(p.left - r.left) < 0.5 &&
            Math.abs(p.width - r.width) < 0.5 &&
            Math.abs(p.height - r.height) < 0.5
              ? p
              : { top: r.top, left: r.left, width: r.width, height: r.height },
          );
        } else if (tries++ > 26) {
          // target is absent or display:none at this viewport — don't strand the player
          // on a dimmed screen with nothing highlighted; move on.
          setRect(null);
          stop = true;
          clearInterval(iv);
          setI((n) => (n + 1 < FLAT.length ? n + 1 : n));
        }
      }
      measure();
      const iv = setInterval(measure, 90);
      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);
      return () => {
        stop = true;
        clearInterval(iv);
        window.removeEventListener("scroll", measure);
        window.removeEventListener("resize", measure);
      };
    }, [i, step.sel]);

    // click-to-advance steps
    useEffect(() => {
      if (step.on !== "click") return;
      function onDocClick(e) {
        const el = document.querySelector(step.sel);
        if (el && (el === e.target || el.contains(e.target))) {
          setSatisfied(true);
          setTimeout(() => advance(), 620);
        }
      }
      document.addEventListener("click", onDocClick, true);
      return () => document.removeEventListener("click", onDocClick, true);
    }, [i, step.sel, step.on]);

    const advance = useCallback(() => {
      setI((n) => {
        if (n + 1 >= FLAT.length) {
          onDone && onDone();
          onClose();
          return n;
        }
        return n + 1;
      });
    }, [onClose, onDone]);

    const pad = 8;
    // clamp the ring to the viewport so an oversized target still reads as a highlight
    const box = rect
      ? (() => {
          const vh = window.innerHeight,
            vw = window.innerWidth;
          const t = rect.top - pad,
            l = rect.left - pad;
          const b = rect.top + rect.height + pad,
            r = rect.left + rect.width + pad;
          const ct = Math.max(4, t),
            cl = Math.max(4, l);
          const cb = Math.min(vh - 4, b),
            cr = Math.min(vw - 4, r);
          return {
            top: ct,
            left: cl,
            width: Math.max(24, cr - cl),
            height: Math.max(24, cb - ct),
            clippedTop: t < 4,
            clippedBottom: b > vh - 4,
          };
        })()
      : null;

    // place the tip below the target, else above, else pinned — always clamped on screen
    const TIP_H = tipH,
      TIP_W = 384,
      M = 12;
    let tipStyle;
    if (box) {
      const vh = window.innerHeight,
        vw = window.innerWidth;
      const fitsBelow = box.top + box.height + TIP_H + M < vh;
      const fitsAbove = box.top - TIP_H - M > 0;
      let top = fitsBelow
        ? box.top + box.height + M
        : fitsAbove
          ? box.top - TIP_H - M
          : vh - TIP_H - M;
      top = Math.max(M, Math.min(top, Math.max(M, vh - TIP_H - M)));
      let left = Math.max(M, Math.min(box.left, vw - TIP_W - M));
      // if the tip would sit on top of the target, slide it beside instead
      const overlaps = top < box.top + box.height && top + TIP_H > box.top;
      if (overlaps && !fitsBelow && !fitsAbove) {
        left =
          box.left + box.width + M + TIP_W < vw
            ? box.left + box.width + M
            : Math.max(M, box.left - TIP_W - M);
      }
      tipStyle = { top, left };
    } else {
      tipStyle = {
        top: Math.max(12, (window.innerHeight - TIP_H) / 2),
        left: Math.max(12, (window.innerWidth - TIP_W) / 2),
      };
    }

    const ch = step.chapter;
    const chIx = CHAPTERS.findIndex((c) => c.id === ch.id);

    return (
      <div className="wt-layer">
        {box && (
          <>
            <div
              className="wt-mask"
              style={{
                clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${box.left}px ${box.top}px,${box.left}px ${box.top + box.height}px,${box.left + box.width}px ${box.top + box.height}px,${box.left + box.width}px ${box.top}px,${box.left}px ${box.top}px)`,
              }}
            />
            <div
              className={
                "wt-ring" +
                (satisfied ? " ok" : "") +
                (box.clippedBottom ? " clip-b" : "") +
                (box.clippedTop ? " clip-t" : "")
              }
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                height: box.height,
                "--cc": ch.color,
              }}
            />
          </>
        )}
        {!box && <div className="wt-mask" style={{ clipPath: "none" }} />}

        <div
          className="wt-tip"
          ref={tipRef}
          style={{ ...tipStyle, "--cc": ch.color }}
        >
          <div className="wt-chapters">
            {CHAPTERS.map((c, k) => (
              <span
                key={c.id}
                className="wt-chip"
                data-on={k === chIx ? "1" : undefined}
                data-done={k < chIx ? "1" : undefined}
                style={{ "--cc": c.color }}
              >
                {c.name}
              </span>
            ))}
          </div>
          <div className="wt-body">
            <div className="wt-avatar">
              {ch.who === "wizard" && <FrostWizard size={44} />}
              {ch.who === "miner" && <DieselMiner size={44} />}
              {ch.who === "dog" && <DogSoldier size={44} rank={1} />}
              {ch.who === "cat" && <QuantumCat size={44} />}
              {ch.who === "captain" && <AlkaneCaptain size={44} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="wt-title" style={{ color: ch.color }}>
                {step.t}
              </div>
              <div className="wt-text">{step.b}</div>
              {step.on === "click" && (
                <div className={"wt-wait" + (satisfied ? " ok" : "")}>
                  {satisfied
                    ? "◆ got it — nice"
                    : "◌ " + (step.wait || "waiting for you…")}
                </div>
              )}
            </div>
          </div>
          <div className="wt-foot">
            <span className="wt-count">
              {i + 1} / {TOTAL}
            </span>
            <div className="wt-prog">
              <i
                style={{
                  width: ((i + 1) / TOTAL) * 100 + "%",
                  background: ch.color,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn sm ghost" onClick={onClose}>
                skip all
              </button>
              {i > 0 && (
                <button className="btn sm ghost" onClick={() => setI(i - 1)}>
                  ◂
                </button>
              )}
              {step.on === "next" && (
                <button className="btn sm" onClick={advance}>
                  next ▸
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, {
    Walkthrough,
    WT_CHAPTERS: CHAPTERS,
    WT_TOTAL: TOTAL,
  });
})();
