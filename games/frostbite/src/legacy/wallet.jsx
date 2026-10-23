// FROST-BITE :: wallet — connect, claim profile, sign session, fund (alkanes-aware), cash out
(function () {
  const { useState } = React;

  const WALLETS = [
    {
      id: "unisat",
      name: "UNISAT",
      sub: "ordinals + runes + alkanes",
      ic: "U",
    },
    {
      id: "xverse",
      name: "XVERSE",
      sub: "taproot native · hardware ok",
      ic: "X",
    },
    { id: "leather", name: "LEATHER", sub: "stacks + btc", ic: "L" },
    { id: "oyl", name: "OYL WALLET", sub: "built for alkanes", ic: "◆" },
  ];

  // ---------- WALLET / ONBOARD FLOW ----------
  function WalletFlow({ onDone }) {
    const [step, setStep] = useState(0);
    const [wallet, setWallet] = useState(null);
    const [handle, setHandle] = useState("");
    const [mode, setMode] = useState("diesel");
    const [signing, setSigning] = useState(false);

    const addr =
      "bc1p" +
      (handle.toLowerCase() || "frost").padEnd(6, "0").slice(0, 6) +
      "q7x2v...af3d9";

    return (
      <div className="overlay">
        <div className="modal" style={{ width: "min(600px,100%)" }}>
          <div className="wf-steps">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="wf-step"
                data-on={i <= step ? "1" : undefined}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                width: 44,
                height: 44,
                border: "1px solid var(--frost)",
                borderRadius: 10,
                boxShadow: "0 0 14px rgba(93,246,255,.5)",
              }}
            >
              <IcSnow size={26} color="#5df6ff" />
            </div>
            <div>
              <div
                className="fd"
                style={{ fontSize: 13, color: "var(--frost)" }}
              >
                FROST·BITE
              </div>
              <div className="ft dim" style={{ fontSize: 15 }}>
                step {step + 1}/4 ·{" "}
                {
                  [
                    "connect a wallet",
                    "claim your profile",
                    "sign the session",
                    "fund for alkanes",
                  ][step]
                }
              </div>
            </div>
          </div>

          {/* PLATFORM: this whole flow is a simulation, and says so on every step. */}
          <div
            className="alk-note"
            style={{ marginBottom: 14 }}
            data-testid="simulation-notice"
          >
            <b>DEMO MODE:</b> no wallet is connected, nothing is signed and
            nothing touches Bitcoin. Pick any option to play; every number and
            address here is simulated.
          </div>

          {/* 1 — CONNECT */}
          {step === 0 && (
            <>
              <div
                className="ft dim"
                style={{ fontSize: 15, marginBottom: 14, lineHeight: 1.5 }}
              >
                No email. No password. No custody. Connect a Bitcoin wallet and
                you're in.
              </div>
              {WALLETS.map((w) => (
                <div
                  key={w.id}
                  className="wallet-opt"
                  onClick={() => {
                    setWallet(w);
                    setStep(1);
                  }}
                >
                  <div className="wo-ic frost">{w.ic}</div>
                  <div>
                    <div className="wo-name">{w.name}</div>
                    <div className="wo-sub">{w.sub}</div>
                  </div>
                  <span
                    className="frost"
                    style={{ fontFamily: "var(--f-display)", fontSize: 9 }}
                  >
                    ▸
                  </span>
                </div>
              ))}
              <div className="alk-note">
                Frost·Bite runs on <b>alkanes</b> — a metaprotocol that puts
                smart-contract tokens directly on Bitcoin UTXOs. Your wallet
                stays yours; we never hold your keys.
              </div>
            </>
          )}

          {/* 2 — CLAIM PROFILE */}
          {step === 1 && (
            <>
              <div
                className="ft"
                style={{ fontSize: 20, color: "var(--frost)", marginBottom: 4 }}
              >
                {wallet.name} CONNECTED
              </div>
              <div
                className="ft dim"
                style={{ fontSize: 15, marginBottom: 14 }}
              >
                Claim a handle. It's inscribed once and it's yours across every
                cabinet.
              </div>
              <div className="field-label">Player handle</div>
              <input
                className="input"
                placeholder="ICE-WALKER"
                value={handle}
                autoFocus
                onChange={(e) =>
                  setHandle(e.target.value.toUpperCase().slice(0, 14))
                }
              />
              <div className="field-label" style={{ marginTop: 16 }}>
                Play mode
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  {
                    k: "diesel",
                    t: "DIESEL",
                    d: "The core loop. 69 blocks per sitting, then a 69-block Touch Grass cooldown.",
                  },
                  {
                    k: "agent",
                    t: "AGENT",
                    d: "42 blocks per sitting, 42-block reindex. Declare bots honestly.",
                  },
                  {
                    k: "dog",
                    t: "$DOG",
                    d: "21 blocks. Double hazards, double treats, bones everywhere.",
                  },
                  {
                    k: "fire",
                    t: "FIRE",
                    d: "33 blocks. More hazards, 2.2× payouts. The greedy lane.",
                  },
                  {
                    k: "air",
                    t: "AIR",
                    d: "88 blocks, 11-block rest. Few hazards, gentle pots. The long game.",
                  },
                  {
                    k: "cheese",
                    t: "CHEESE",
                    d: "27 blocks. Hazard count randomised per board. Unexplained.",
                  },
                ].map((m) => (
                  <div
                    key={m.k}
                    className="wallet-opt"
                    style={{
                      margin: 0,
                      borderColor:
                        mode === m.k
                          ? MODES[m.k]
                            ? MODES[m.k].color
                            : "var(--frost)"
                          : undefined,
                      boxShadow:
                        mode === m.k
                          ? `0 0 14px ${MODES[m.k] ? MODES[m.k].color : "#5df6ff"}55`
                          : undefined,
                    }}
                    onClick={() => setMode(m.k)}
                  >
                    <div
                      className="wo-ic"
                      style={{
                        color: MODES[m.k] ? MODES[m.k].color : "var(--frost)",
                      }}
                    >
                      {m.k === "dog" ? (
                        <DogSoldier size={26} />
                      ) : m.k === "agent" ? (
                        <QuantumCat size={26} />
                      ) : m.k === "diesel" ? (
                        <DieselMiner size={26} />
                      ) : m.k === "fire" ? (
                        "▲"
                      ) : m.k === "air" ? (
                        "≈"
                      ) : m.k === "cheese" ? (
                        "●"
                      ) : (
                        "☃"
                      )}
                    </div>
                    <div>
                      <div
                        className="wo-name"
                        style={{
                          color:
                            mode === m.k ? "var(--paper)" : "var(--silver)",
                        }}
                      >
                        {m.t}
                      </div>
                      <div className="wo-sub">{m.d}</div>
                    </div>
                    <span
                      style={{
                        color:
                          mode === m.k
                            ? MODES[m.k]
                              ? MODES[m.k].color
                              : "var(--frost)"
                            : "var(--grey)",
                        fontSize: 14,
                      }}
                    >
                      {mode === m.k ? "◉" : "○"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="dock" style={{ marginTop: 18 }}>
                <button className="btn ghost" onClick={() => setStep(0)}>
                  ◂ back
                </button>
                <button
                  className="btn lg"
                  style={{ flex: 1 }}
                  disabled={!handle.trim()}
                  onClick={() => setStep(2)}
                >
                  ▸ CLAIM PROFILE
                </button>
              </div>
            </>
          )}

          {/* 3 — SIGN SESSION */}
          {step === 2 && (
            <>
              <div
                className="ft dim"
                style={{ fontSize: 15, marginBottom: 12, lineHeight: 1.5 }}
              >
                One signature authorises Frost·Bite to broadcast{" "}
                <b className="frost">your picks</b> on your behalf — and to pay
                the fee while doing it.
              </div>
              <div className="sign-box">
                <div>
                  <span className="c">// frostbite session authority</span>
                </div>
                <div>
                  <span className="k">protocol</span>:{" "}
                  <span className="v">alkanes / bitcoin mainnet</span>
                </div>
                <div>
                  <span className="k">handle</span>:{" "}
                  <span className="v">{handle}</span>
                </div>
                <div>
                  <span className="k">mode</span>:{" "}
                  <span className="v">{mode}</span>
                </div>
                <div>
                  <span className="k">grants</span>:{" "}
                  <span className="v">broadcast_picks, mint_receipt</span>
                </div>
                <div>
                  <span className="k">denies</span>:{" "}
                  <span className="v">spend_utxo, transfer_out, custody</span>
                </div>
                <div>
                  <span className="k">fee_payer</span>:{" "}
                  <span className="v">frostbite.house</span>
                </div>
                <div>
                  <span className="k">diesel_credit</span>:{" "}
                  <span className="v">player (on cashout)</span>
                </div>
                <div>
                  <span className="k">expires</span>:{" "}
                  <span className="v">4096 blocks</span>
                </div>
              </div>
              <div className="alk-note">
                <b>Why this is free:</b> the house signs and broadcasts every
                gameplay transaction, so the house pays the sats. Because it
                signs, <b>the house mines the diesel</b> — and credits your
                share back to you when you cash out. You spend nothing to play.
              </div>
              <div className="dock" style={{ marginTop: 16 }}>
                <button className="btn ghost" onClick={() => setStep(1)}>
                  ◂ back
                </button>
                <button
                  className="btn lg"
                  style={{ flex: 1 }}
                  disabled={signing}
                  onClick={() => {
                    setSigning(true);
                    setTimeout(() => {
                      setSigning(false);
                      setStep(3);
                    }, 850);
                  }}
                >
                  {signing ? "◌ SIGNING…" : "▸ SIGN SESSION (FREE)"}
                </button>
              </div>
            </>
          )}

          {/* 4 — FUND */}
          {step === 3 && (
            <>
              <div
                className="ft"
                style={{ fontSize: 20, color: "var(--frost)", marginBottom: 4 }}
              >
                ADD BTC FOR ALKANES
              </div>
              <div className="ft dim" style={{ fontSize: 15, lineHeight: 1.5 }}>
                Playing is free. But alkanes tokens live{" "}
                <span className="frost">on UTXOs</span> — to
                <b> receive</b> GLACIER, DIESEL or dxBTC you need a little BTC
                in your wallet to carry them.
              </div>
              <div
                style={{
                  background:
                    "linear-gradient(135deg,rgba(255,210,74,.08),rgba(93,246,255,.04))",
                  border: "1px dashed var(--gold)",
                  borderRadius: 10,
                  padding: 16,
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                <div
                  className="fd"
                  style={{
                    fontSize: 9,
                    color: "var(--silver)",
                    letterSpacing: ".12em",
                  }}
                >
                  SUGGESTED TOP-UP
                </div>
                <div
                  className="fd gold"
                  style={{
                    fontSize: 36,
                    margin: "8px 0",
                    textShadow: "0 0 14px rgba(255,210,74,.4)",
                  }}
                >
                  $21
                </div>
                <div className="ft dim" style={{ fontSize: 14 }}>
                  ≈ <span className="gold">0.00032 BTC</span> · covers UTXO dust
                  + every future claim
                </div>
                <div
                  className="ft"
                  style={{
                    fontSize: 13,
                    color: "var(--frost)",
                    marginTop: 8,
                    wordBreak: "break-all",
                  }}
                >
                  {addr}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="kv">
                  <span className="k">to play</span>
                  <span className="v" style={{ color: "var(--mint)" }}>
                    0 sat · house signs
                  </span>
                </div>
                <div className="kv">
                  <span className="k">to hold tokens</span>
                  <span className="v gold" style={{ color: "var(--gold)" }}>
                    ~330 sat dust
                  </span>
                </div>
                <div className="kv">
                  <span className="k">to cash out</span>
                  <span className="v mag" style={{ color: "var(--magenta)" }}>
                    ~280 sat + 15% split
                  </span>
                </div>
              </div>
              <div className="dock" style={{ marginTop: 18 }}>
                <button
                  className="btn ghost"
                  onClick={() =>
                    onDone({ handle, mode, wallet: wallet.name, funded: false })
                  }
                >
                  skip · play free
                </button>
                <button
                  className="btn lg gold"
                  style={{ flex: 1 }}
                  onClick={() =>
                    onDone({ handle, mode, wallet: wallet.name, funded: true })
                  }
                >
                  ▸ FUND &amp; ENTER
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- CASHOUT ----------
  function CashoutModal({
    icicles,
    glacierTier,
    diesel,
    dieselPot,
    playShare,
    houseCut,
    badges,
    onClose,
    onCashout,
  }) {
    const [minted, setMinted] = useState(null);
    const tier = TIERS[glacierTier - 1];
    const mult = tier ? tier.mult : 1;
    const glacierTokens = (icicles * mult) / 100;
    const potShare = dieselPot * playShare;
    const dieselTotal = diesel + potShare;
    const houseGl = glacierTokens * (houseCut / 100);
    const yourGl = glacierTokens - houseGl;
    const fee = 280;

    if (minted) {
      return (
        <div className="cashdrawer">
          <div className="cd-panel" style={{ textAlign: "center" }}>
            <div
              className="fd"
              style={{
                fontSize: 12,
                color: "var(--mint)",
                letterSpacing: ".1em",
              }}
            >
              ◆ CASHOUT CONFIRMED ◆
            </div>
            <div className="ft dim" style={{ fontSize: 15, marginTop: 6 }}>
              minted on alkanes · settles next block
            </div>
            <div
              className="glacier-frame"
              style={{
                margin: "18px auto 0",
                width: 260,
                height: 290,
                position: "relative",
              }}
            >
              <div className="glacier-mint">
                <OrbitalGlacier
                  seed={minted.seed}
                  size={240}
                  tier={glacierTier || 1}
                />
              </div>
              <div className="g-id">
                ORBITAL GLACIER #{minted.seed % 9999} ·{" "}
                {tier ? tier.name : "SHELF"}
              </div>
            </div>
            <div style={{ marginTop: 16, textAlign: "left" }}>
              <div className="kv">
                <span className="k">GLACIER tokens</span>
                <span className="v" style={{ color: "var(--mint)" }}>
                  {yourGl.toFixed(3)}
                </span>
              </div>
              <div className="kv">
                <span className="k">DIESEL credited</span>
                <span className="v" style={{ color: "var(--hot)" }}>
                  {dieselTotal.toFixed(4)}
                </span>
              </div>
              <div className="kv">
                <span className="k">orbital glacier</span>
                <span className="v frost" style={{ color: "var(--frost)" }}>
                  1 minted
                </span>
              </div>
              <div className="kv">
                <span className="k">badges earned</span>
                <span className="v gold" style={{ color: "var(--gold)" }}>
                  {badges} total
                </span>
              </div>
            </div>
            <div className="dock" style={{ marginTop: 18 }}>
              <button className="btn lg block" onClick={onClose}>
                ▸ BACK TO THE ICE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="cashdrawer">
        <div className="cd-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <div className="fd frost" style={{ fontSize: 13 }}>
              ▸ CASH OUT
            </div>
            <button className="btn sm ghost" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="ft dim" style={{ fontSize: 15, marginBottom: 16 }}>
            convert in-game <b className="frost">icicles</b> → on-chain{" "}
            <b className="mint" style={{ color: "var(--mint)" }}>
              GLACIER
            </b>{" "}
            alkane tokens, and collect your slice of the diesel pot
          </div>

          {icicles === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div className="fd dim" style={{ fontSize: 13 }}>
                NO ICICLES BANKED
              </div>
              <div className="ft dim" style={{ fontSize: 16, marginTop: 8 }}>
                win some boards first.
              </div>
            </div>
          ) : (
            <>
              <div className="payout-row win">
                <div className="ico frost" style={{ color: "var(--frost)" }}>
                  ❄
                </div>
                <div className="lab">
                  icicles banked
                  <span className="s">in-game token · not on chain</span>
                </div>
                <div className="amt">{icicles.toLocaleString()}</div>
              </div>
              <div className="payout-row win">
                <div
                  className="ico"
                  style={{ color: tier ? tier.color : "var(--grey)" }}
                >
                  {glacierTier ? (
                    <GlacierIce tier={glacierTier} size={24} />
                  ) : (
                    "▲"
                  )}
                </div>
                <div className="lab">
                  {tier ? tier.name : "no glacier built"}
                  <span className="s">
                    {tier
                      ? `${mult}× conversion bonus`
                      : "build a glacier for 3×/6×/9×"}
                  </span>
                </div>
                <div
                  className="amt"
                  style={{ color: tier ? tier.color : "var(--grey)" }}
                >
                  {mult}×
                </div>
              </div>
              <div className="payout-row win">
                <div className="ico" style={{ color: "var(--hot)" }}>
                  <IcFuel size={20} />
                </div>
                <div className="lab">
                  diesel · mined by the house on your txs
                  <span className="s">
                    {diesel.toFixed(4)} direct + {potShare.toFixed(4)} pot share
                    ({(playShare * 100).toFixed(1)}% of play)
                  </span>
                </div>
                <div className="amt" style={{ color: "var(--hot)" }}>
                  {dieselTotal.toFixed(4)}
                </div>
              </div>

              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(90deg,transparent,var(--rim),transparent)",
                  margin: "14px 0",
                }}
              />

              <div className="payout-row fee">
                <div className="ico">
                  <IcLock />
                </div>
                <div className="lab">
                  <span className="dim">house split · {houseCut}%</span>
                  <span className="s">keeps the lights cold</span>
                </div>
                <div className="amt">−{houseGl.toFixed(3)} GLACIER</div>
              </div>
              <div className="payout-row fee">
                <div className="ico">⛓</div>
                <div className="lab">
                  <span className="dim">alkanes mint fee</span>
                  <span className="s">the one time you pay sats</span>
                </div>
                <div className="amt">−{fee} sat</div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: "1px solid var(--mint)",
                  borderRadius: 10,
                  background: "rgba(111,255,176,.06)",
                  boxShadow: "0 0 18px rgba(111,255,176,.18)",
                }}
              >
                <div
                  className="fd"
                  style={{
                    fontSize: 9,
                    color: "var(--silver)",
                    letterSpacing: ".12em",
                  }}
                >
                  YOU RECEIVE
                </div>
                <div
                  className="ft"
                  style={{
                    fontSize: 26,
                    color: "var(--mint)",
                    textShadow: "0 0 8px rgba(111,255,176,.5)",
                  }}
                >
                  {yourGl.toFixed(3)} GLACIER
                </div>
                <div
                  className="ft"
                  style={{ fontSize: 16, color: "var(--hot)" }}
                >
                  + {dieselTotal.toFixed(4)} DIESEL
                </div>
                {glacierTier === 3 && (
                  <div
                    className="ft"
                    style={{ fontSize: 15, color: "var(--aurora)" }}
                  >
                    + 1 generative orbital glacier
                  </div>
                )}
              </div>

              <div className="dock" style={{ marginTop: 18 }}>
                <button className="btn ghost" onClick={onClose}>
                  ◂ keep playing
                </button>
                <button
                  className="btn lg mag"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const seed = Date.now() % 99991;
                    setMinted({ seed });
                    onCashout({ glacier: yourGl, diesel: dieselTotal, seed });
                  }}
                >
                  ▸ SIGN &amp; MINT
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  Object.assign(window, { WalletFlow, CashoutModal, WALLETS });
})();
