// FROST-BITE :: BURN — icicles and glaciers are fuel, not just score
// Burning is the only sink in the economy. Everything here destroys supply
// permanently and hands back something that isn't a number going up.
(function () {
const { useState, useEffect, useRef, useCallback } = React;

// ---------------------------------------------------------------------------
// What you can burn for. Costs are deliberately steep — a sink that nobody
// feels is not a sink, it is a rounding error.
// ---------------------------------------------------------------------------
const BURNS = [
  { id: "vote", name: "CAST A VOTE", icon: "▣", color: "#5df6ff",
    cost: { icicles: 250 }, unit: "vote",
    blurb: "Burn to vote on the next cabinet, the house cut, or a rule change.",
    detail: "One burn, one vote, counted on-chain. Votes are not rented — the icicles are gone whichever way the ballot goes, which is what stops a whale borrowing a majority for an afternoon." },
  { id: "levelup", name: "LEVEL A CABINET", icon: "▲", color: "#6fffb0",
    cost: { icicles: 600 }, unit: "level",
    blurb: "Permanently raise a cabinet's payout curve for everyone.",
    detail: "Levelling is global and permanent. You pay, the whole arcade gets the better curve — a public good bought by one player, which is the only reason the number means anything." },
  { id: "stakes", name: "RAISE THE STAKES", icon: "◆", color: "#ff2d9d",
    cost: { icicles: 400 }, unit: "round",
    blurb: "Double hazards and double payouts on your next four boards.",
    detail: "One round only. Twice the mines, twice the pot. The burn happens whether the round goes well or badly." },
  { id: "reroll", name: "REROLL THE QUEUE", icon: "↻", color: "#ffd24a",
    cost: { icicles: 150 }, unit: "reroll",
    blurb: "Burn for a fresh set of four cabinets, no block lost.",
    detail: "The queue rerolls instantly and the block clock keeps running. Cheap, and the one burn you will reach for without thinking." },
  { id: "thaw", name: "THAW A BUST", icon: "❄", color: "#8effff",
    cost: { icicles: 900 }, unit: "rescue",
    blurb: "Un-bust one board before its block lands.",
    detail: "Expensive on purpose. A bust you can buy your way out of cheaply is not a bust, and the whole game leans on the moment you decide to stop." },
  { id: "forge", name: "FORGE A RELIC", icon: "✦", color: "#a280ff",
    cost: { glacier: 3 }, unit: "relic",
    blurb: "Burn GLACIER for a generative relic that carries a permanent perk.",
    detail: "The only burn that costs on-chain tokens rather than in-game points. The relic is minted from your play history, and its perk applies to every future session." },
];

const VOTES = [
  { id: "v1", q: "Which cabinet should we build next?",
    opts: ["GLACIER GOLF", "MEMPOOL SURF", "HASH HOCKEY", "COLD STORAGE HEIST"] },
  { id: "v2", q: "Where should the house cut land?",
    opts: ["15% — as is", "12% — thinner house", "10% — thinnest viable", "18% — fund faster builds"] },
  { id: "v3", q: "What should the next burn unlock?",
    opts: ["Custom cabinet skins", "A private table with friends", "Tournament entry", "Longer block budgets"] },
];

function BurnVenue({ icicles, glacier, cabinets, onBurn, onMine }) {
  const [sel, setSel] = useState(null);
  const [voteFor, setVoteFor] = useState(VOTES[0].id);
  const [cabFor, setCabFor] = useState("sats");
  const [done, setDone] = useState(null);
  const [tally, setTally] = useState(() => {
    try { return JSON.parse(localStorage.getItem("frostbite.votes.v1") || "{}"); } catch (e) { return {}; }
  });
  const [levels, setLevels] = useState(() => {
    try { return JSON.parse(localStorage.getItem("frostbite.levels.v1") || "{}"); } catch (e) { return {}; }
  });

  const totalBurned = (() => {
    try { return JSON.parse(localStorage.getItem("frostbite.burned.v1") || "0"); } catch (e) { return 0; }
  })();

  function afford(b) {
    if (b.cost.icicles) return icicles >= b.cost.icicles;
    if (b.cost.glacier) return glacier >= b.cost.glacier;
    return false;
  }

  function commit(b) {
    if (!afford(b)) return;
    const payload = { kind: b.id };
    if (b.id === "vote") payload.vote = { ballot: voteFor, choice: sel && sel.choice };
    if (b.id === "levelup") payload.cabinet = cabFor;

    // tally the vote locally so the burn visibly does something
    if (b.id === "vote" && payload.vote.choice != null) {
      const key = voteFor + ":" + payload.vote.choice;
      const next = { ...tally, [key]: (tally[key] || 0) + 1 };
      setTally(next);
      try { localStorage.setItem("frostbite.votes.v1", JSON.stringify(next)); } catch (e) {}
    }
    if (b.id === "levelup") {
      const next = { ...levels, [cabFor]: (levels[cabFor] || 1) + 1 };
      setLevels(next);
      try { localStorage.setItem("frostbite.levels.v1", JSON.stringify(next)); } catch (e) {}
    }
    try {
      localStorage.setItem("frostbite.burned.v1",
        JSON.stringify(totalBurned + (b.cost.icicles || 0)));
    } catch (e) {}

    onBurn && onBurn(b, payload);
    onMine && onMine("burn");
    window.FBLog && FBLog.event("burn", { kind: b.id, cost: b.cost, ...payload });
    setDone({ b, at: Date.now() });
    setTimeout(() => setDone(null), 3200);
  }

  const ballot = VOTES.find((v) => v.id === voteFor) || VOTES[0];

  return (
    <div className="burn">
      <div className="burn-hero">
        <div className="burn-flame">
          <span/><span/><span/>
        </div>
        <div>
          <div className="fort-kicker">THE FURNACE · THE ONLY SINK</div>
          <div className="fort-title">Points that only ever<br/>go up are not an economy.</div>
          <div className="fort-sub">
            Every burn destroys supply permanently and hands back something a bigger number
            cannot buy: a vote that counts, a cabinet that pays better for everyone, a round
            with the stakes doubled. Nothing here is refundable, and that is the point.
          </div>
          <div className="fort-badges">
            <span className="fort-badge tier">{Math.round(icicles).toLocaleString()} ICICLES</span>
            <span className="fort-badge">{glacier.toFixed(2)} GLACIER</span>
            <span className="fort-badge amber">{Number(totalBurned).toLocaleString()} BURNED TO DATE</span>
          </div>
        </div>
      </div>

      <div className="burn-grid">
        {BURNS.map((b) => {
          const ok = afford(b);
          const on = sel && sel.id === b.id;
          return (
            <div key={b.id} className={"burn-card" + (on ? " on" : "") + (ok ? "" : " poor")}
                 style={{ "--bc": b.color }}
                 onClick={() => setSel(on ? null : { id: b.id, choice: null })}>
              <div className="bc-top">
                <span className="bc-icon">{b.icon}</span>
                <span className="bc-cost">
                  {b.cost.icicles ? b.cost.icicles.toLocaleString() + " ❄" : b.cost.glacier + " ◆"}
                </span>
              </div>
              <div className="bc-name">{b.name}</div>
              <div className="bc-blurb">{b.blurb}</div>
              {on && (
                <>
                  <div className="bc-detail">{b.detail}</div>

                  {b.id === "vote" && (
                    <div className="bc-form" onClick={(e) => e.stopPropagation()}>
                      <select className="input" value={voteFor} onChange={(e) => { setVoteFor(e.target.value); setSel({ id: b.id, choice: null }); }}>
                        {VOTES.map((v) => <option key={v.id} value={v.id}>{v.q}</option>)}
                      </select>
                      <div className="bc-opts">
                        {ballot.opts.map((o, k) => {
                          const n = tally[ballot.id + ":" + k] || 0;
                          return (
                            <button key={o} className={"bc-opt" + (sel.choice === k ? " on" : "")}
                                    onClick={() => setSel({ id: b.id, choice: k })}>
                              <span>{o}</span><b>{n}</b>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {b.id === "levelup" && (
                    <div className="bc-form" onClick={(e) => e.stopPropagation()}>
                      <div className="bc-opts">
                        {(window.GAME9_KEYS || []).map((k) => {
                          const g = (window.GAMES9 || {})[k]; if (!g) return null;
                          return (
                            <button key={k} className={"bc-opt" + (cabFor === k ? " on" : "")}
                                    onClick={() => setCabFor(k)}>
                              <span>{g.name}</span><b>Lv{levels[k] || 1}</b>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button className="btn block" style={{ marginTop: 10, borderColor: b.color, color: ok ? b.color : undefined }}
                          disabled={!ok || (b.id === "vote" && sel.choice == null)}
                          onClick={(e) => { e.stopPropagation(); commit(b); }}>
                    {ok ? "▸ BURN · NO REFUNDS" : "NOT ENOUGH"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div className="burn-done" style={{ "--bc": done.b.color }}>
          <span className="bd-icon">{done.b.icon}</span>
          <div>
            <div className="bd-t">BURNED · {done.b.name}</div>
            <div className="bd-s">supply destroyed · {done.b.unit} granted</div>
          </div>
        </div>
      )}

      <CharSay who="frost">
        A token with no fire under it is a spreadsheet with delusions. Burn something,
        and what remains is worth marginally more. That is the whole of monetary policy,
        said politely.
      </CharSay>
    </div>
  );
}

Object.assign(window, { BurnVenue, BURNS, VOTES });
})();
