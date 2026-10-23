// FROST-BITE :: MINERCRAFT — community cabinet forge + graduation gauntlet
(function () {
  const { useState } = React;

  // Graduation rule: pass all 4 audits AND hold 30 consecutive days
  // with a >= 21 players/day average. Then it ships to the main Arcade.
  const AUDITS = [
    "reentrancy",
    "utxo-safety",
    "payout-solvency",
    "rng-fairness",
  ];

  const SUBMITTED = [
    {
      id: "g1",
      name: "SATSWEEPER 3000",
      by: "wizard.sats",
      grad: true,
      audits: [1, 1, 1, 1],
      days: [
        24, 26, 21, 29, 22, 31, 25, 23, 27, 22, 28, 24, 26, 21, 30, 23, 25, 29,
        22, 27, 24, 26, 28, 21, 25, 30, 23, 27, 22, 26,
      ],
      avg: 25.4,
      blurb: "9×9 deep-field sweeper with wizard hat power-ups",
    },
    {
      id: "g2",
      name: "ORDINAL ORBIT",
      by: "quantum.cat",
      grad: true,
      audits: [1, 1, 1, 1],
      days: [
        22, 25, 21, 23, 27, 24, 21, 26, 22, 28, 23, 25, 21, 24, 29, 22, 26, 23,
        27, 21, 25, 24, 22, 28, 23, 26, 21, 25, 27, 22,
      ],
      avg: 24.1,
      blurb: "gravity-slingshot inscription catcher",
    },
    {
      id: "g3",
      name: "RUNE RUMBLE",
      grad: false,
      by: "dog.army",
      audits: [1, 1, 1, 0],
      days: [
        19, 24, 21, 18, 26, 22, 15, 23, 21, 25, 20, 22, 19, 24, 21, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      avg: 21.3,
      blurb: "4-player rune-stacking brawler · very loud",
    },
    {
      id: "g4",
      name: "MEMPOOL MADNESS",
      grad: false,
      by: "0xfrostbyte",
      audits: [1, 1, 0, 0],
      days: [
        14, 18, 12, 21, 16, 19, 11, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0,
      ],
      avg: 16.0,
      blurb: "fee-market surfing endless runner",
    },
    {
      id: "g5",
      name: "TAPROOT TAROT",
      grad: false,
      by: "seer.btc",
      audits: [1, 0, 0, 0],
      days: [
        9, 12, 7, 14, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
      ],
      avg: 10.6,
      blurb: "card-draw prediction with script-path reveals",
    },
    {
      id: "g6",
      name: "ICE FISHIN'",
      grad: false,
      by: "coldstorage",
      audits: [0, 0, 0, 0],
      days: [
        3, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
      ],
      avg: 3.3,
      blurb: "hook UTXOs through a hole in the ice",
    },
  ];

  function MinerCraft({ onMine }) {
    const [showForge, setShowForge] = useState(false);
    return (
      <div>
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head">
            <span>
              ▸ minercraft · build a cabinet, graduate it, earn the rake
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
              4 audits + 30 days above 21 players/day
            </span>
          </div>
          <div className="panel-body">
            <CharSay who="miner">
              Anybody can forge a cabinet here. Nobody skips the gauntlet. Four
              security audits, then thirty consecutive days averaging twenty-one
              players a day. Graduate and your game lands in the main Arcade —
              you take 5% of its rake, forever.
            </CharSay>
          </div>
        </div>

        <div className="mc-grid">
          <div
            className="mc-forge"
            onClick={() => {
              setShowForge(true);
              onMine && onMine("forge-open");
            }}
          >
            <div
              style={{
                fontSize: 34,
                filter: "drop-shadow(0 0 10px var(--frost))",
                color: "var(--frost)",
              }}
            >
              ✦
            </div>
            <div
              className="fd frost"
              style={{ fontSize: 10, letterSpacing: ".1em" }}
            >
              FORGE A CABINET
            </div>
            <div
              className="ft dim"
              style={{ fontSize: 14, maxWidth: 200, lineHeight: 1.4 }}
            >
              drop in a game spec · we generate the alkanes contract scaffold
              and queue audit #1
            </div>
          </div>

          {SUBMITTED.map((g) => {
            const passed = g.audits.filter(Boolean).length;
            const activeDays = g.days.filter((d) => d > 0).length;
            return (
              <div
                key={g.id}
                className="mc-card"
                data-grad={g.grad ? "1" : undefined}
              >
                <div className="mc-head">
                  <div>
                    <div className="mc-name">{g.name}</div>
                    <div className="mc-by">by {g.by}</div>
                  </div>
                  <span
                    className={
                      "mc-stat " +
                      (g.grad
                        ? "pass"
                        : passed === 4
                          ? "pend"
                          : passed === 0
                            ? "fail"
                            : "pend")
                    }
                  >
                    {g.grad
                      ? "GRADUATED"
                      : passed === 0
                        ? "UNAUDITED"
                        : "IN GAUNTLET"}
                  </span>
                </div>
                <div
                  className="ft dim"
                  style={{
                    fontSize: 13.5,
                    marginTop: 8,
                    lineHeight: 1.4,
                    minHeight: 38,
                  }}
                >
                  {g.blurb}
                </div>

                <div className="mc-audits">
                  {AUDITS.map((a, i) => (
                    <div key={a} className="mc-audit">
                      <span
                        className={
                          "tick " +
                          (g.audits[i] ? "ok" : i === passed ? "wait" : "no")
                        }
                      >
                        {g.audits[i] ? "✓" : i === passed ? "◌" : "✕"}
                      </span>
                      <span
                        style={{
                          color: g.audits[i] ? "var(--silver)" : "var(--grey)",
                        }}
                      >
                        {a}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--f-term)",
                          fontSize: 12,
                          color: g.audits[i] ? "var(--mint)" : "var(--grey)",
                        }}
                      >
                        {g.audits[i]
                          ? "pass"
                          : i === passed
                            ? "running"
                            : "queued"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mc-players">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--f-display)",
                      fontSize: 7,
                      letterSpacing: ".1em",
                      color: "var(--silver)",
                      marginBottom: 5,
                    }}
                  >
                    <span>DAILY PLAYERS · AVG {g.avg}</span>
                    <span
                      style={{
                        color: g.avg >= 21 ? "var(--mint)" : "var(--hot)",
                      }}
                    >
                      {g.avg >= 21 ? "ABOVE BAR" : "BELOW 21/DAY"}
                    </span>
                  </div>
                  <div className="mc-ptrack">
                    <i
                      style={{ width: Math.min(100, (g.avg / 30) * 100) + "%" }}
                    />
                    <div
                      className="cap"
                      style={{ left: (21 / 30) * 100 + "%" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 5,
                      fontFamily: "var(--f-term)",
                      fontSize: 12.5,
                      color: "var(--silver)",
                    }}
                  >
                    <span>
                      <b style={{ color: "var(--frost)" }}>{activeDays}</b>/30
                      days logged
                    </span>
                    <span className="dimmer">hard cap 30 players/day</span>
                  </div>
                  <div className="mc-days">
                    {g.days.map((d, i) => (
                      <i
                        key={i}
                        data-hit={d >= 21 ? "1" : undefined}
                        data-miss={d > 0 && d < 21 ? "1" : undefined}
                        title={d ? d + " players" : "no data"}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showForge && (
          <div className="overlay" onClick={() => setShowForge(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div className="fd frost" style={{ fontSize: 12 }}>
                  ▸ FORGE A CABINET
                </div>
                <button
                  className="btn sm ghost"
                  onClick={() => setShowForge(false)}
                >
                  ✕
                </button>
              </div>
              <div className="field-label">Cabinet name</div>
              <input
                className="input"
                placeholder="SATSWEEPER 3000"
                style={{ marginBottom: 14 }}
              />
              <div className="field-label">One-line pitch</div>
              <input
                className="input"
                placeholder="9×9 deep-field sweeper with wizard hat power-ups"
                style={{ marginBottom: 14 }}
              />
              <div className="field-label">Core loop</div>
              <select className="input" style={{ marginBottom: 6 }}>
                <option>pick-safe / avoid-mine (standard payout curve)</option>
                <option>timing / reflex (block-window scored)</option>
                <option>PvP free-for-all (KOTS ruleset)</option>
                <option>puzzle / sort (Subzero ruleset)</option>
              </select>
              <div className="alk-note">
                We scaffold your cabinet as an <b>alkanes</b> contract and
                enroll it in the gauntlet:
                <b> 4 security audits</b>, then <b>30 consecutive days</b> at{" "}
                <b>21+ players/day average</b>
                (hard cap 30/day so nobody can farm their own graduation).
                Graduate and your cabinet ships to the main Arcade with a{" "}
                <b>5% perpetual rake</b> to your address.
              </div>
              <div className="dock">
                <button
                  className="btn ghost"
                  onClick={() => setShowForge(false)}
                >
                  ◂ cancel
                </button>
                <button
                  className="btn lg"
                  style={{ flex: 1 }}
                  onClick={() => setShowForge(false)}
                >
                  ▸ SUBMIT TO GAUNTLET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  Object.assign(window, { MinerCraft });
})();
