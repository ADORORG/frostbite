// FROST-BITE :: SATBAG — shareable win cards, ad slots, cashout drawer
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  // Every card carries a real Bitcoin fact and the play link. A win card that only
  // says "I won" is a screenshot; one that teaches something is a reason to click.
  const CARD_FACTS = [
    "Bitcoin blocks target 10 minutes — this board settled on a real one.",
    "DIESEL is alkane 2:0. Whoever signs the transaction mines it.",
    "The genesis block hides a newspaper headline from 3 January 2009.",
    "One satoshi is 0.00000001 BTC. Eight decimals, chosen arbitrarily, now an atom.",
    "Difficulty retargets every 2,016 blocks so ten minutes stays ten minutes.",
    "In 2010 an integer overflow minted 184 billion BTC. It was fixed in five hours.",
    "Confirmed is not succeeded — a protostone can revert and still be mined.",
    "Taproot activated at block 709,632. Alkanes lives in the seam it opened.",
    "10,000 BTC bought two pizzas in 2010. That was the day it became money.",
    "The nonce is 32 bits. Four billion guesses per header, and no shortcut.",
  ];
  const PLAY_URL = "frostbite.arcade";

  // ---------- generative win card ----------
  function WinCard({ card, big }) {
    const s = big ? 1 : 0.62;
    const seed = card.seed;
    let r = seed >>> 0 || 11;
    const rr = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
    const rings = Array.from({ length: 5 }, () => ({
      a: rr() * 360,
      w: 20 + rr() * 60,
      o: 0.2 + rr() * 0.5,
    }));
    const hot = card.streak >= 3;
    const fact = CARD_FACTS[(card.seed >>> 0) % CARD_FACTS.length];
    return (
      <div
        className={"wcard" + (big ? " big" : "")}
        style={{ "--wc": card.color, "--s": s }}
      >
        <div className="wc-glow" />
        <svg className="wc-orbital" viewBox="0 0 120 120">
          <defs>
            <radialGradient id={"wg" + seed}>
              <stop offset="0%" stopColor={card.color} stopOpacity=".9" />
              <stop offset="70%" stopColor={card.color} stopOpacity=".1" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="34" fill={`url(#wg${seed})`} />
          <circle
            cx="60"
            cy="60"
            r="21"
            fill="none"
            stroke={card.color}
            strokeWidth="1.4"
            opacity=".8"
          />
          {rings.map((g, i) => (
            <ellipse
              key={i}
              cx="60"
              cy="60"
              rx={30 + i * 8}
              ry={(30 + i * 8) * 0.34}
              fill="none"
              stroke={card.color}
              strokeWidth="1"
              opacity={g.o}
              transform={`rotate(${g.a} 60 60)`}
            />
          ))}
          {rings.map((g, i) => (
            <circle
              key={"d" + i}
              r="2.4"
              fill={hot ? "#ffd24a" : card.color}
              cx={60 + Math.cos(g.a) * (30 + i * 8)}
              cy={60 + Math.sin(g.a) * (30 + i * 8) * 0.34}
            />
          ))}
        </svg>
        <div className="wc-top">
          <span className="wc-brand">FROST·BITE</span>
          <span className="wc-blk">#{card.height.toLocaleString()}</span>
        </div>
        <div className="wc-mid">
          <div className="wc-amt">+{card.icicles}</div>
          <div className="wc-unit">ICICLES</div>
          <div className="wc-game">{card.game}</div>
        </div>
        <div className="wc-fact">
          <span>DID YOU KNOW</span>
          {fact}
        </div>
        <div className="wc-bot">
          <span className="wc-h">{card.handle}</span>
          <span className="wc-badges">
            {card.streak > 1 && (
              <b className="wc-streak">×{card.streak} STREAK</b>
            )}
            <b className="wc-mult">{card.mult}</b>
          </span>
        </div>
        <div className="wc-serial">▸ PLAY FREE · {PLAY_URL}</div>
      </div>
    );
  }

  // draw the card to a canvas and hand back a PNG blob
  async function cardToPng(card) {
    const W = 900,
      H = 1200,
      c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b1226");
    g.addColorStop(0.5, "#04060d");
    g.addColorStop(1, "#070b1a");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(
      W / 2,
      H * 0.38,
      0,
      W / 2,
      H * 0.38,
      W * 0.7,
    );
    rg.addColorStop(0, card.color + "44");
    rg.addColorStop(1, "transparent");
    x.fillStyle = rg;
    x.fillRect(0, 0, W, H);
    // orbital
    x.save();
    x.translate(W / 2, H * 0.31);
    let r = card.seed >>> 0 || 11;
    const rr = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 5; i++) {
      const rad = 130 + i * 46,
        a = rr() * 6.28;
      x.save();
      x.rotate(a);
      x.strokeStyle = card.color;
      x.globalAlpha = 0.25 + rr() * 0.45;
      x.lineWidth = 2.5;
      x.beginPath();
      x.ellipse(0, 0, rad, rad * 0.34, 0, 0, 7);
      x.stroke();
      x.globalAlpha = 1;
      x.fillStyle = card.streak >= 3 ? "#ffd24a" : card.color;
      x.beginPath();
      x.arc(rad, 0, 9, 0, 7);
      x.fill();
      x.restore();
    }
    x.globalAlpha = 1;
    x.fillStyle = card.color + "33";
    x.beginPath();
    x.arc(0, 0, 96, 0, 7);
    x.fill();
    x.strokeStyle = card.color;
    x.lineWidth = 4;
    x.beginPath();
    x.arc(0, 0, 96, 0, 7);
    x.stroke();
    x.restore();
    // text — one running cursor, so nothing can be authored into an overlap
    x.textAlign = "center";
    x.fillStyle = "#5df6ff";
    x.font = "700 34px 'JetBrains Mono', monospace";
    x.fillText("F R O S T · B I T E", W / 2, 92);
    x.fillStyle = "#aebed6";
    x.font = "26px 'JetBrains Mono', monospace";
    x.fillText("BLOCK #" + card.height.toLocaleString(), W / 2, 138);

    let y = H * 0.63;
    x.fillStyle = card.color;
    x.font = "700 160px 'JetBrains Mono', monospace";
    x.fillText("+" + card.icicles, W / 2, y);
    y += 52;
    x.fillStyle = "#e8f4ff";
    x.font = "38px 'JetBrains Mono', monospace";
    x.fillText("ICICLES", W / 2, y);
    y += 44;
    x.fillStyle = "#aebed6";
    x.font = "30px 'JetBrains Mono', monospace";
    x.fillText(card.game, W / 2, y);
    y += 46;
    x.fillStyle = card.streak >= 3 ? "#ff6b35" : "#6fffb0";
    x.font = "700 38px 'JetBrains Mono', monospace";
    x.fillText(
      card.mult + (card.streak > 1 ? "   ×" + card.streak + " STREAK" : ""),
      W / 2,
      y,
    );
    y += 46;
    x.fillStyle = "#e8f4ff";
    x.font = "700 40px 'JetBrains Mono', monospace";
    x.fillText(card.handle, W / 2, y);

    // the fun fact — measured and wrapped, anchored to the bottom block
    const fact = CARD_FACTS[(card.seed >>> 0) % CARD_FACTS.length];
    const factLines = (() => {
      x.font = "26px 'JetBrains Mono', monospace";
      const words = fact.split(" "),
        out = [];
      let line = "";
      for (const w of words) {
        const t = line ? line + " " + w : w;
        if (x.measureText(t).width > W - 130 && line) {
          out.push(line);
          line = w;
        } else line = t;
      }
      if (line) out.push(line);
      return out;
    })();
    const factTop = H - 58 - 26 - factLines.length * 32;
    x.fillStyle = "#5df6ff";
    x.font = "700 20px 'JetBrains Mono', monospace";
    x.fillText("D I D   Y O U   K N O W", W / 2, factTop);
    x.fillStyle = "#aebed6";
    x.font = "26px 'JetBrains Mono', monospace";
    factLines.forEach((l, i) => x.fillText(l, W / 2, factTop + 34 + i * 32));

    x.fillStyle = "#ffd24a";
    x.font = "700 32px 'JetBrains Mono', monospace";
    x.fillText("▸ PLAY FREE  ·  " + PLAY_URL, W / 2, H - 46);
    x.fillStyle = "#3a4565";
    x.font = "18px 'JetBrains Mono', monospace";
    x.fillText(card.id, W / 2, H - 18);
    return new Promise((res) => c.toBlob(res, "image/png"));
  }

  // ---------- SatBag drawer ----------
  function SatBag({
    cards,
    open,
    onToggle,
    onCashout,
    icicles,
    diesel,
    glacierTier,
    sfx,
    unseen,
  }) {
    const [sel, setSel] = useState(0);
    const [busy, setBusy] = useState(false);
    const card = cards[sel];

    async function download() {
      if (!card) return;
      setBusy(true);
      try {
        const blob = await cardToPng(card);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "frostbite-" + card.id + ".png";
        a.click();
        sfx && sfx("coin");
      } finally {
        setBusy(false);
      }
    }
    async function share() {
      if (!card) return;
      const fact = CARD_FACTS[(card.seed >>> 0) % CARD_FACTS.length];
      const text = [
        `+${card.icicles} icicles out of ${card.game} on block #${card.height.toLocaleString()}.`,
        card.streak > 1
          ? `×${card.streak} streak. ${card.mult}.`
          : `${card.mult}.`,
        ``,
        `Did you know: ${fact}`,
        ``,
        `Frost·Bite — a block-paced arcade on Bitcoin. Free to play, the house pays the sats.`,
        `▸ ${PLAY_URL}`,
      ].join("\n");
      try {
        const blob = await cardToPng(card);
        const file = new File([blob], "frostbite.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text, title: "Frost·Bite" });
        } else if (navigator.share) {
          await navigator.share({ text, title: "Frost·Bite" });
        } else {
          await navigator.clipboard.writeText(text);
          sfx && sfx("correct");
        }
      } catch (e) {}
    }

    return (
      <div className={"satbag" + (open ? " open" : "")}>
        <button
          className={"sb-tab" + (unseen > 0 && !open ? " alert" : "")}
          onClick={onToggle}
        >
          {unseen > 0 && !open && <span className="sbt-new">{unseen} NEW</span>}
          <span className="sbt-ico">◆</span>
          <span className="sbt-n">{cards.length}</span>
          <span className="sbt-l">SATBAG</span>
        </button>
        {open && (
          <div className="sb-body">
            <div className="sb-head">
              <span
                className="fd"
                style={{
                  fontSize: 8,
                  color: "var(--frost)",
                  letterSpacing: ".12em",
                }}
              >
                ▸ SATBAG · {cards.length} CARDS
              </span>
              <button className="btn sm ghost" onClick={onToggle}>
                ✕
              </button>
            </div>
            {!cards.length ? (
              <div className="sb-empty">
                No cards yet.
                <br />
                <span>
                  Win a board and a card drops in here — the game never stops
                  for it.
                </span>
              </div>
            ) : (
              <>
                <div className="sb-stage">
                  <WinCard card={card} big />
                </div>
                <div className="sb-acts">
                  <button className="btn sm" onClick={download} disabled={busy}>
                    {busy ? "…" : "⇩ PNG"}
                  </button>
                  <button className="btn sm mag" onClick={share}>
                    ↗ SHARE
                  </button>
                </div>
                <div className="sb-strip">
                  {cards.map((c, i) => (
                    <button
                      key={c.id}
                      className={"sb-thumb" + (i === sel ? " on" : "")}
                      onClick={() => setSel(i)}
                      style={{ "--wc": c.color }}
                    >
                      <b>+{c.icicles}</b>
                      <span>{c.game.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="sb-cash">
              <div className="sb-cash-row">
                <span>ICICLES</span>
                <b className="frost">{Math.round(icicles)}</b>
              </div>
              <div className="sb-cash-row">
                <span>DIESEL</span>
                <b className="hot">{diesel.toFixed(4)}</b>
              </div>
              <div className="sb-cash-row">
                <span>GLACIER</span>
                <b className="gold">
                  {glacierTier ? ["", "3×", "6×", "9×"][glacierTier] : "none"}
                </b>
              </div>
              <button
                className="btn block mag"
                style={{ marginTop: 10 }}
                onClick={onCashout}
                disabled={icicles <= 0}
              >
                ◆ CASH OUT ON THE SIDE
              </button>
              <div
                className="ft dim"
                style={{ fontSize: 12.5, marginTop: 7, lineHeight: 1.4 }}
              >
                Cashout runs in this drawer. Boards keep playing behind it —
                nothing interrupts a run.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // toast-sized card that slides in on a win, auto-retires into the bag
  function WinCardToast({ card, onOpen }) {
    if (!card) return null;
    return (
      <div className="wc-toast" onClick={onOpen}>
        <WinCard card={card} />
        <div className="wct-cta">▸ SAVED TO SATBAG · TAP TO SHARE</div>
      </div>
    );
  }

  // ---------- AD SLOTS — three, honest, non-blocking ----------
  const HOUSE_ADS = [
    {
      id: "h1",
      tag: "HOUSE",
      title: "BUILD A CABINET",
      body: "Nine games shipped. Yours could be the tenth — MinerCraft takes submissions.",
      cta: "SUBMIT A GAME",
      color: "#6fffb0",
      to: "submit",
    },
    {
      id: "h2",
      tag: "HOUSE",
      title: "READ OUR POSTURE",
      body: "Tier, red lines, invariants, attacker cost. Published live inside the game.",
      cta: "OPEN THE FORTRESS",
      color: "#8effff",
      to: "fortress",
    },
    {
      id: "h3",
      tag: "HOUSE",
      title: "THE SUBZERO CORE",
      body: "Four worlds. Eleven attempts a year. A hex globe that fights back.",
      cta: "ENTER THE CORE",
      color: "#a280ff",
      to: "subzero",
    },
  ];

  function AdSlot({ slot, ad, onGo, onMine }) {
    const [gone, setGone] = useState(false);
    if (gone) return null;
    const a = ad || HOUSE_ADS[slot % 3];
    return (
      <div className={"adslot slot-" + slot} style={{ "--ac": a.color }}>
        <div className="ad-head">
          <span className="ad-tag">{a.tag}</span>
          <span className="ad-slot-id">AD {slot + 1}/3</span>
          <button className="ad-x" onClick={() => setGone(true)} title="hide">
            ✕
          </button>
        </div>
        <div className="ad-title">{a.title}</div>
        <div className="ad-body">{a.body}</div>
        <button
          className="ad-cta"
          onClick={() => {
            onGo && onGo(a.to);
            onMine && onMine("ad-click");
          }}
        >
          {a.cta} ▸
        </button>
        <div className="ad-foot">
          house slot · no trackers, no third-party scripts
        </div>
      </div>
    );
  }

  Object.assign(window, {
    SatBag,
    WinCard,
    WinCardToast,
    AdSlot,
    HOUSE_ADS,
    cardToPng,
  });
})();
