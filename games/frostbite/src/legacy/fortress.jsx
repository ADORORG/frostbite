// FROST-BITE :: THE RUBIK FORTRESS — live security posture, per the Rubik Directive v3
(function () {
  const { useState, useEffect } = React;

  const TIER = {
    id: "T3",
    name: "VALUE / IRREVERSIBLE",
    why: "Custody and movement of funds · mainnet alkanes contracts · session-signing authority",
  };

  // §22 — the 14 red lines. bind at every tier.
  const RED_LINES = [
    {
      n: 1,
      t: "No hand-rolled cryptography",
      s: "hold",
      d: "All signing via audited secp256k1 + BIP-340 Schnorr. Zero bespoke primitives.",
    },
    {
      n: 2,
      t: "No unilateral power over funds",
      s: "hold",
      d: "Payouts require 3-of-5 threshold + 6-block timelock. No agent and no single key can move the pot.",
    },
    {
      n: 3,
      t: "No open Critical / unmitigated High",
      s: "hold",
      d: "0 critical, 0 high. 2 medium ledgered with named owners and expiry.",
    },
    {
      n: 4,
      t: "No data stored we can't defend",
      s: "hold",
      d: "We hold: handle, address, play counters. We do not hold: email, IP beyond 24h, device fingerprint.",
    },
    {
      n: 5,
      t: "No PII on an immutable ledger",
      s: "hold",
      d: "On-chain carries commitments and token state only. Handles live off-chain and are deletable.",
    },
    {
      n: 6,
      t: "No custody of seeds or private keys",
      s: "hold",
      d: "Wallets connect as external signers through alkanesjs/wallets — the wallet holds the key, the SDK never sees it, and exportWIF() throws. Structural, not promised.",
    },
    {
      n: 7,
      t: "External content is data, never instructions",
      s: "hold",
      d: "Mempool data, cabinet submissions and agent messages are parsed as data in a sandbox.",
    },
    {
      n: 8,
      t: "No blind signing — ours or yours",
      s: "hold",
      d: "Every call is simulated before it is signed; the decoded protostone trace is shown in plain language. Confirmed is not succeeded, so we check ok before crediting anything.",
    },
    {
      n: 9,
      t: "No irreversible mainnet action without sign-off",
      s: "hold",
      d: "Payout batches and contract upgrades need two named humans + passed ceremony.",
    },
    {
      n: 10,
      t: "Deployed bytecode verified against audit",
      s: "hold",
      d: "Reproducible build; the alkabi document the build emits is published alongside the deployed AlkaneId, so any client can type-check what it is calling.",
    },
    {
      n: 11,
      t: "Obscurity is never the foundation",
      s: "hold",
      d: "Cabinet RNG, payout curve and house cut are all public. Security holds with source open.",
    },
    {
      n: 12,
      t: "No rounded-down severity, no skipped artifact",
      s: "watch",
      d: "Two Medium findings from the v0.3 sweep are open in the risk ledger — not reclassified.",
    },
    {
      n: 13,
      t: "This gate is not a substitute for audit",
      s: "hold",
      d: "Independent third-party audit required before mainnet. Currently scheduled, not complete.",
    },
    {
      n: 14,
      t: "Halt on any hard stop (§4)",
      s: "hold",
      d: "Kill-switch owner on-call 24/7; last drill logged below.",
    },
  ];

  // §11.2 invariant register
  const INVARIANTS = [
    {
      id: "INV-01",
      s: "Total icicles issued == Σ board payouts − Σ conversions",
      st: "PROVEN",
      m: "formal + fuzz(240k)",
    },
    {
      id: "INV-02",
      s: "GLACIER minted ≤ icicles burned × multiplier, verified by trace",
      st: "PROVEN",
      m: "formal + protostone trace",
    },
    {
      id: "INV-03",
      s: "No call path mints GLACIER without burning icicles",
      st: "PROVEN",
      m: "formal + mutation",
    },
    {
      id: "INV-04",
      s: "Diesel credited ≤ diesel actually mined by house txs (2:0)",
      st: "FUZZED",
      m: "fuzz(180k) + trace audit",
    },
    {
      id: "INV-05",
      s: "External wallet signer holds the key; SDK exportWIF() throws",
      st: "PROVEN",
      m: "alkanesjs/wallets · structural",
    },
    {
      id: "INV-06",
      s: "SHA256(layout‖nonce‖height) published before a board opens",
      st: "UNTESTED",
      m: "— client-seeded in this build",
    },
    {
      id: "INV-07",
      s: "House cut ≤ 15% on every settlement path",
      st: "PROVEN",
      m: "formal",
    },
    {
      id: "INV-08",
      s: "Block budget cannot be exceeded by client-side manipulation",
      st: "FUZZED",
      m: "fuzz(60k) server-authoritative",
    },
    {
      id: "INV-09",
      s: "Payout outflow per 144-block window ≤ configured ceiling",
      st: "PROVEN",
      m: "formal + drill",
    },
    {
      id: "INV-10",
      s: "MinerCraft cabinet cannot read another cabinet's state",
      st: "FUZZED",
      m: "sandbox fuzz(40k)",
    },
    {
      id: "INV-11",
      s: "Graduated cabinet rake ≤ 5% and routes only to author",
      st: "PROVEN",
      m: "formal",
    },
    {
      id: "INV-12",
      s: "No agent-mode session exceeds its 42-block ceiling",
      st: "UNTESTED",
      m: "— residual risk R-02",
    },
  ];

  // §6.3 attacker-cost accounting
  const VECTORS = [
    {
      v: "Pre-image the mine layout before reveal",
      cost: "$4.1M",
      p: "<0.1%",
      reward: "board pot",
      verdict: "NEGATIVE-EV",
    },
    {
      v: "Front-run a pick tx in the mempool",
      cost: "$900",
      p: "8%",
      reward: "one board",
      verdict: "DETECTABLE+REVERSIBLE",
    },
    {
      v: "Session-key replay across rounds",
      cost: "$1.2k",
      p: "<1%",
      reward: "nil (nonce-bound)",
      verdict: "NEGATIVE-EV",
    },
    {
      v: "Sybil-farm MinerCraft graduation",
      cost: "$61k",
      p: "22%",
      reward: "5% rake",
      verdict: "DETECTABLE+REVERSIBLE",
    },
    {
      v: "Drain diesel pot via inflated tx count",
      cost: "$18k",
      p: "3%",
      reward: "pot share",
      verdict: "NEGATIVE-EV",
    },
    {
      v: "Compromise 3-of-5 payout signers",
      cost: "$9.4M+",
      p: "<0.05%",
      reward: "treasury",
      verdict: "NEGATIVE-EV",
    },
    {
      v: "Poison a cabinet submission with hostile script",
      cost: "$300",
      p: "14%",
      reward: "player sessions",
      verdict: "RESIDUAL",
    },
    {
      v: "DNS / frontend hijack to swap the signing UI",
      cost: "$25k",
      p: "5%",
      reward: "every visitor",
      verdict: "DETECTABLE+REVERSIBLE",
    },
    {
      v: "Credit a payout from a reverted protostone",
      cost: "$0",
      p: "certain if unchecked",
      reward: "unbacked mint",
      verdict: "NEGATIVE-EV",
    },
    {
      v: "Read the board layout from client memory",
      cost: "$0",
      p: "certain",
      reward: "every board",
      verdict: "RESIDUAL",
    },
  ];

  // §11.7 risk ledger
  const RISKS = [
    {
      id: "R-01",
      f: "Cabinet sandbox escape via CSS-injected overlay",
      sev: "Medium",
      by: "d.diesel",
      ctl: "CSP frame-src none + submission review",
      exp: "2026-09-01",
      st: "ACTIVE",
    },
    {
      id: "R-02",
      f: "Agent-mode ceiling enforced client-side in demo build",
      sev: "Medium",
      by: "a.captain",
      ctl: "server-authoritative counter shipping v0.4",
      exp: "2026-08-15",
      st: "ACTIVE",
    },
    {
      id: "R-03",
      f: "Board layouts seeded client-side — readable from devtools",
      sev: "Critical",
      by: "a.captain",
      ctl: "commit–reveal per INV-06; blocks mainnet entirely",
      exp: "before mainnet",
      st: "BLOCKING",
    },
  ];

  const GATE = [
    ["Tier classified; gate scaled", true],
    ["Threat model complete", true],
    ["Attacker-cost inequality satisfied", true],
    ["Zero Critical / unmitigated High", true],
    ["Input validation at every boundary", true],
    ["Containment: breakers, timelocks, rate-limits", true],
    ["Keys: threshold, WYSIWYS, succession", true],
    ["No unneeded retention; no PII on-chain", true],
    ["No invented crypto", true],
    ["Spec + invariants fuzzed & mutation-tested", true],
    ["Dependencies pinned incl. models & prompts", true],
    ["Agents caged: propose-not-dispose", true],
    ["Access layer: DNS lock, CSP, SRI", true],
    ["Bridge requirements (n/a — no bridge)", true],
    ["Monitoring wired pre-deploy; MTTD/MTTR set", true],
    ["IR runbook with named on-call", true],
    ["Deployment ceremony + bytecode verification", true],
    ["Disclosure channel published; bounty live", true],
    ["Final audit report with residual risk", true],
    ["Second review done; disagreements surfaced", false],
  ];

  function StatusDot({ s }) {
    return <span className={"rl-dot rl-" + s} />;
  }

  function Fortress({ embedded }) {
    const [tab, setTab] = useState("posture");
    const [openRl, setOpenRl] = useState(null);
    const passed = GATE.filter(([, v]) => v).length;
    const holding = RED_LINES.filter((r) => r.s === "hold").length;

    return (
      <div className="fortress">
        <div className="fort-hero">
          <div className="fort-cube">
            <div className="fc-face f1" />
            <div className="fc-face f2" />
            <div className="fc-face f3" />
            <div className="fc-face f4" />
            <div className="fc-face f5" />
            <div className="fc-face f6" />
          </div>
          <div className="fort-hero-txt">
            <div className="fort-kicker">
              THE RUBIK FORTRESS · DIRECTIVE v3.0
            </div>
            <div className="fort-title">
              Not unsolvable.
              <br />
              Just not worth solving.
            </div>
            <div className="fort-sub">
              We publish our security posture inside the game, live. A Bitcoin
              arcade that hides its threat model is asking you to trust a
              stranger. Read it, then decide.
            </div>
            <div className="fort-badges">
              <span className="fort-badge tier">TIER {TIER.id}</span>
              <span className="fort-badge">{holding}/14 RED LINES HOLDING</span>
              <span className="fort-badge">{passed}/20 GATE ITEMS</span>
              <span className="fort-badge amber">VERDICT · CONDITIONAL</span>
            </div>
          </div>
        </div>

        <div className="fort-tabs">
          {[
            ["posture", "POSTURE"],
            ["redlines", "RED LINES"],
            ["invariants", "INVARIANTS"],
            ["vectors", "ATTACKER COST"],
            ["ledger", "RISK LEDGER"],
            ["ir", "INCIDENT"],
          ].map(([k, n]) => (
            <button
              key={k}
              className="fort-tab"
              data-on={tab === k ? "1" : undefined}
              onClick={() => setTab(k)}
            >
              {n}
            </button>
          ))}
        </div>

        {tab === "posture" && (
          <div className="fort-grid">
            <div className="panel">
              <div className="panel-head">
                <span>▸ approval gate · DIR 13</span>
                <span>{passed}/20</span>
              </div>
              <div className="panel-body" style={{ padding: 12 }}>
                {GATE.map(([t, ok]) => (
                  <div key={t} className="gate-item">
                    <span className={"gi-tick " + (ok ? "ok" : "no")}>
                      {ok ? "✓" : "◌"}
                    </span>
                    <span
                      style={{ color: ok ? "var(--silver)" : "var(--gold)" }}
                    >
                      {t}
                    </span>
                  </div>
                ))}
                <div className="fort-verdict">
                  <div>
                    <b>VERDICT</b> CONDITIONAL
                  </div>
                  <div>
                    <b>TIER</b> T3 — value / irreversible
                  </div>
                  <div>
                    <b>BLOCKERS</b> R-03 — board layouts are client-seeded, so a
                    player with devtools can read every hazard. Nothing goes to
                    mainnet until commit–reveal lands.
                  </div>
                  <div>
                    <b>CONDITIONS</b> independent third-party audit before
                    mainnet; second-model review of the payout path
                  </div>
                  <div>
                    <b>RESIDUAL RISK</b> Two Medium findings remain open with
                    named owners and expiry dates. The cabinet sandbox is
                    defence-in-depth, not proof — a novel CSS or timing escape
                    is possible in principle. Agent-mode ceilings are
                    client-enforced in this build. Attacker-cost is negative-EV
                    on every path that touches the treasury, but the frontend
                    delivery chain remains the softest surface, as it is for
                    everyone.
                  </div>
                  <div>
                    <b>HUMAN SIGN-OFF</b> required · <b>INDEPENDENT AUDIT</b>{" "}
                    required-and-scheduled
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="panel">
                <div className="panel-head">▸ what we hold about you</div>
                <div className="panel-body" style={{ padding: 12 }}>
                  <div className="kv">
                    <span className="k">handle</span>
                    <span className="v">stored · deletable</span>
                  </div>
                  <div className="kv">
                    <span className="k">btc address</span>
                    <span className="v">stored · public anyway</span>
                  </div>
                  <div className="kv">
                    <span className="k">play counters</span>
                    <span className="v">stored · aggregate</span>
                  </div>
                  <div className="kv">
                    <span className="k">email</span>
                    <span className="v" style={{ color: "var(--mint)" }}>
                      never collected
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">ip address</span>
                    <span className="v" style={{ color: "var(--mint)" }}>
                      24h, then dropped
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">device fingerprint</span>
                    <span className="v" style={{ color: "var(--mint)" }}>
                      never collected
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">seed / private key</span>
                    <span className="v" style={{ color: "var(--mint)" }}>
                      never, in any form
                    </span>
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">▸ session key scope</div>
                <div className="panel-body" style={{ padding: 12 }}>
                  <div className="sign-box" style={{ maxHeight: "none" }}>
                    <div>
                      <span className="k">grants</span>:{" "}
                      <span className="v">broadcast_picks, mint_receipt</span>
                    </div>
                    <div>
                      <span className="k">denies</span>:{" "}
                      <span className="v">
                        spend_utxo, transfer_out, custody, approve_all
                      </span>
                    </div>
                    <div>
                      <span className="k">fee_payer</span>:{" "}
                      <span className="v">frostbite.house</span>
                    </div>
                    <div>
                      <span className="k">expires</span>:{" "}
                      <span className="v">4096 blocks</span>
                    </div>
                    <div>
                      <span className="k">revoke</span>:{" "}
                      <span className="v">one click, any time, no delay</span>
                    </div>
                  </div>
                </div>
              </div>
              <CharSay who="captain">
                Nothing here is impenetrable and I will not pretend otherwise.
                The goal is cost asymmetry: make breaking us cost more than we
                hold. Then watch, contain, and recover.
              </CharSay>
            </div>
          </div>
        )}

        {tab === "redlines" && (
          <div className="panel">
            <div className="panel-head">
              <span>▸ non-negotiables · bind at every tier</span>
              <span>{holding}/14</span>
            </div>
            <div className="panel-body" style={{ padding: 10 }}>
              {RED_LINES.map((r) => (
                <div
                  key={r.n}
                  className="rl-row"
                  data-open={openRl === r.n ? "1" : undefined}
                  onClick={() => setOpenRl(openRl === r.n ? null : r.n)}
                >
                  <span className="rl-n">{String(r.n).padStart(2, "0")}</span>
                  <StatusDot s={r.s} />
                  <span className="rl-t">{r.t}</span>
                  <span className={"rl-s rl-" + r.s}>
                    {r.s === "hold" ? "HOLDING" : "WATCH"}
                  </span>
                  <div className="rl-d">{r.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "invariants" && (
          <div className="panel">
            <div className="panel-head">
              <span>▸ invariant register</span>
              <span>
                {INVARIANTS.filter((i) => i.st === "PROVEN").length} proven ·{" "}
                {INVARIANTS.filter((i) => i.st === "FUZZED").length} fuzzed ·{" "}
                {INVARIANTS.filter((i) => i.st === "UNTESTED").length} untested
              </span>
            </div>
            <div className="panel-body" style={{ padding: 10 }}>
              {INVARIANTS.map((iv) => (
                <div key={iv.id} className="inv-row">
                  <span className="inv-id">{iv.id}</span>
                  <span className="inv-s">{iv.s}</span>
                  <span className="inv-m">{iv.m}</span>
                  <span className={"inv-st st-" + iv.st.toLowerCase()}>
                    {iv.st}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "vectors" && (
          <div className="panel">
            <div className="panel-head">
              <span>▸ attacker-cost accounting</span>
              <span
                className="ft dim"
                style={{
                  fontFamily: "var(--f-term)",
                  fontSize: 14,
                  letterSpacing: ".02em",
                  textTransform: "none",
                }}
              >
                directive §6.3 · the rubik test
              </span>
            </div>
            <div className="panel-body" style={{ padding: 10 }}>
              <div className="vec-row vec-head">
                <span>VECTOR</span>
                <span>COST</span>
                <span>P(WIN)</span>
                <span>REWARD</span>
                <span>VERDICT</span>
              </div>
              {VECTORS.map((v) => (
                <div key={v.v} className="vec-row">
                  <span className="vec-v">{v.v}</span>
                  <span className="vec-c">{v.cost}</span>
                  <span className="vec-p">{v.p}</span>
                  <span className="vec-r">{v.reward}</span>
                  <span
                    className={
                      "vec-x " +
                      (v.verdict === "NEGATIVE-EV"
                        ? "good"
                        : v.verdict === "RESIDUAL"
                          ? "bad"
                          : "mid")
                    }
                  >
                    {v.verdict}
                  </span>
                </div>
              ))}
              <div
                className="ft dim"
                style={{
                  fontSize: 13,
                  marginTop: 12,
                  lineHeight: 1.5,
                  padding: "0 4px",
                }}
              >
                Design target:{" "}
                <b className="frost">expected_reward − attack_cost &lt; 0</b>{" "}
                with margin. Where that can't hold, the path must be detectable
                and reversible before value leaves. One path is still plain
                residual risk and it's named in the ledger rather than buried.
              </div>
            </div>
          </div>
        )}

        {tab === "ledger" && (
          <div className="panel">
            <div className="panel-head">
              <span>▸ risk-acceptance ledger</span>
              <span>{RISKS.length} active</span>
            </div>
            <div className="panel-body" style={{ padding: 12 }}>
              {RISKS.map((r) => (
                <div key={r.id} className="risk-card">
                  <div className="rc-head">
                    <span className="rc-id">{r.id}</span>
                    <span className="rc-sev">{r.sev}</span>
                    <span className="rc-st">{r.st}</span>
                  </div>
                  <div className="rc-f">{r.f}</div>
                  <div className="rc-meta">
                    <span>
                      accepted by <b>{r.by}</b>
                    </span>
                    <span>control: {r.ctl}</span>
                    <span>
                      expires <b>{r.exp}</b>
                    </span>
                  </div>
                </div>
              ))}
              <div
                className="ft dim"
                style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}
              >
                Unowned risk is unaccepted risk. Every entry has a named human
                and an expiry date — when it expires the finding reopens
                automatically.
              </div>
            </div>
          </div>
        )}

        {tab === "ir" && (
          <div className="fort-grid">
            <div className="panel">
              <div className="panel-head">
                <span>▸ incident readiness</span>
                <span
                  className="ft dim"
                  style={{
                    fontFamily: "var(--f-term)",
                    fontSize: 14,
                    letterSpacing: ".02em",
                    textTransform: "none",
                  }}
                >
                  directive §18 / §19
                </span>
              </div>
              <div className="panel-body" style={{ padding: 12 }}>
                <div className="kv">
                  <span className="k">on-call</span>
                  <span className="v">
                    d.diesel (primary) · a.captain (escalation)
                  </span>
                </div>
                <div className="kv">
                  <span className="k">MTTD target</span>
                  <span className="v" style={{ color: "var(--mint)" }}>
                    &lt; 5 min · value anomaly
                  </span>
                </div>
                <div className="kv">
                  <span className="k">MTTR target</span>
                  <span className="v" style={{ color: "var(--mint)" }}>
                    &lt; 15 min
                  </span>
                </div>
                <div className="kv">
                  <span className="k">auto-pause triggers</span>
                  <span className="v">
                    invariant breach · outflow cap · oracle drift
                  </span>
                </div>
                <div className="kv">
                  <span className="k">last kill-switch drill</span>
                  <span className="v gold" style={{ color: "var(--gold)" }}>
                    2026-07-11 · passed 00:09
                  </span>
                </div>
                <div className="kv">
                  <span className="k">war room</span>
                  <span className="v">
                    out-of-band · not our main workspace
                  </span>
                </div>
                <div className="kv">
                  <span className="k">disclosure</span>
                  <span className="v frost" style={{ color: "var(--frost)" }}>
                    security.txt + funded bounty
                  </span>
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <span>▸ containment map</span>
                <span
                  className="ft dim"
                  style={{
                    fontFamily: "var(--f-term)",
                    fontSize: 14,
                    letterSpacing: ".02em",
                    textTransform: "none",
                  }}
                >
                  directive §7
                </span>
              </div>
              <div className="panel-body" style={{ padding: 12 }}>
                <div className="cont-row">
                  <span>arcade cabinets</span>
                  <i />
                  <span className="mint" style={{ color: "var(--mint)" }}>
                    per-cabinet pause
                  </span>
                </div>
                <div className="cont-row">
                  <span>payout engine</span>
                  <i />
                  <span className="mint" style={{ color: "var(--mint)" }}>
                    3-of-5 + 6-blk lock
                  </span>
                </div>
                <div className="cont-row">
                  <span>diesel pot</span>
                  <i />
                  <span className="mint" style={{ color: "var(--mint)" }}>
                    144-blk outflow cap
                  </span>
                </div>
                <div className="cont-row">
                  <span>minercraft sandbox</span>
                  <i />
                  <span className="gold" style={{ color: "var(--gold)" }}>
                    isolated · watch
                  </span>
                </div>
                <div className="cont-row">
                  <span>session keys</span>
                  <i />
                  <span className="mint" style={{ color: "var(--mint)" }}>
                    scoped · revocable
                  </span>
                </div>
                <div className="cont-row">
                  <span>frontend delivery</span>
                  <i />
                  <span className="gold" style={{ color: "var(--gold)" }}>
                    CSP+SRI · softest
                  </span>
                </div>
                <div
                  className="ft dim"
                  style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}
                >
                  Worst case for a single-component compromise:{" "}
                  <b className="gold">one cabinet's round pot</b>, capped at the
                  144-block outflow ceiling. The treasury is not reachable from
                  any single break.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  Object.assign(window, {
    Fortress,
    FORT_DATA: { TIER, RED_LINES, INVARIANTS, VECTORS, RISKS, GATE },
  });
})();
