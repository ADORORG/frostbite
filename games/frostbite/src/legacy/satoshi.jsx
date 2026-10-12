// FROST-BITE :: transmissions from the other side
(function () {
const { useState, useEffect, useRef } = React;

// Real Bitcoin history + protocol knowledge, delivered as if from beyond.
const TRANSMISSIONS = [
  { id: 1, tag: "GENESIS", h: 0,
    t: "I buried a newspaper in the first block.",
    b: "The genesis coinbase carries the headline of The Times, 3 January 2009: banks bailed out. A timestamp no one could forge and a reason no one could delete. The 50 coins in that block can never be spent — a quirk of how I wired it, and I let it stand.",
    k: "Block 0 · 3 Jan 2009 · reward permanently unspendable" },
  { id: 2, tag: "PROOF", h: 170,
    t: "The first coins I ever sent went to a man who believed me.",
    b: "Ten bitcoin, block 170, to Hal Finney. He ran the software when almost nobody would. The first transaction between two people was an act of trust settled by mathematics — which is the entire trick.",
    k: "Block 170 · 12 Jan 2009 · first P2P transaction" },
  { id: 3, tag: "SCARCITY", h: 210000,
    t: "Twenty-one million was never a number. It was a promise.",
    b: "Every 210,000 blocks the subsidy halves. Add the geometric series and it converges just under 21 million. I did not pick the cap; I picked the rule, and the cap is what the rule implies.",
    k: "Halving every 210,000 blocks · ~4 years" },
  { id: 4, tag: "TIME", h: 2016,
    t: "The network breathes every two weeks.",
    b: "Difficulty retargets every 2,016 blocks so ten minutes stays ten minutes whether ten people mine or ten million. It is the only clock that does not care who is looking at it.",
    k: "Retarget every 2016 blocks · 10 min target" },
  { id: 5, tag: "LORE", h: 57043,
    t: "Somebody bought two pizzas and made history taste expensive.",
    b: "22 May 2010: 10,000 BTC for two pizzas. People tell it as a joke about a fortune lost. It is actually the moment the ledger became money — the first time a number in a database bought a thing you could eat.",
    k: "22 May 2010 · 10,000 BTC · Bitcoin Pizza Day" },
  { id: 6, tag: "WARNING", h: 74638,
    t: "It broke once. Badly. We fixed it in five hours.",
    b: "15 August 2010, block 74638: an integer overflow minted 184 billion BTC out of nothing. A patch, a soft fork, a reorg, and the chain that should not be rewritten was rewritten. Nothing is impenetrable. Everything is recoverable if you are watching.",
    k: "CVE-2010-5139 · value overflow · fixed in ~5 hours" },
  { id: 7, tag: "DUST", h: null,
    t: "The smallest piece of me is named after me.",
    b: "One hundred millionth of a coin. A satoshi. I never named it — you did, after I was gone. Eight decimal places was arbitrary engineering; it became the atom of a monetary system.",
    k: "1 satoshi = 0.00000001 BTC" },
  { id: 8, tag: "EXIT", h: 102387,
    t: "I have moved on to other things.",
    b: "December 2010, my last public words, more or less. The most important thing I ever built needed me to leave it. A protocol with a founder still holding the wheel is not a protocol — it is a company wearing one.",
    k: "Last confirmed message · Dec 2010" },
  { id: 9, tag: "MEMPOOL", h: null,
    t: "The waiting room is where the truth lives.",
    b: "Before a transaction is history it is a rumour in the mempool — visible, reorderable, front-runnable. Frost·Bite pays your fee to get you out of that room fast. Anything unconfirmed is a wish, not a fact.",
    k: "Unconfirmed tx are reorderable by miners" },
  { id: 10, tag: "SCRIPT", h: 709632,
    t: "They taught the coins to carry secrets.",
    b: "Taproot, November 2021: every spend looks the same on the surface, and complex conditions hide inside a single key. Alkanes — the thing your icicles will become — lives in that seam I left open.",
    k: "Taproot activated block 709632 · Nov 2021" },
  { id: 11, tag: "WORK", h: null,
    t: "There is no vote. There is only the work.",
    b: "Four billion nonces per block header, and no shortcut. Not cleverness, not authority, not consensus by committee — just the honest cost of guessing. Every game you play here is settled by that same coin flip.",
    k: "32-bit nonce space · 4.29 billion values" },
  { id: 12, tag: "FORKS", h: 478558,
    t: "They will copy the ledger and call it the ledger.",
    b: "Chains split. Names get taken. The one that survives is the one people keep spending work on. Consensus is not a document; it is a decision the whole world re-makes every ten minutes.",
    k: "Chain splits are social before they are technical" },
  { id: 13, tag: "ORDER", h: 767430,
    t: "Somebody wrote a picture into a coin and everything changed again.",
    b: "Ordinals, early 2023. Individual satoshis given identity and content. I did not plan for it. That is the point of leaving: the thing outgrows the intent, and the taproot wizards and quantum cats arrive uninvited.",
    k: "Ordinal inscriptions · from block 767430" },
  { id: 14, tag: "KEYS", h: null,
    t: "Not your keys, not your coins — and I mean it more than you do.",
    b: "There is no support desk in mathematics. No reset, no appeal, no manager. The freedom and the terror are the same property viewed from two sides.",
    k: "Irreversibility is the feature and the risk" },
  { id: 15, tag: "PATIENCE", h: null,
    t: "Ten minutes is a moral position.",
    b: "I could have made it faster. Faster means more forks, more reorgs, more chances to lie. The delay is not latency — it is the time the truth takes to set. Your four boards defrost on that clock for the same reason.",
    k: "10 min block target · finality over speed" },
  { id: 16, tag: "HOUSE", h: null,
    t: "Somebody always pays the fee.",
    b: "In this arcade the house signs your picks, so the house pays your sats — and mines the diesel that comes with signing. Nothing is free; some things are simply paid for by someone else. Know which one you are looking at.",
    k: "Fee-payer ≠ beneficiary · always ask who signs" },

  // ---- the protocol layer: alkanes, subfrost, frBTC, dxBTC, FUEL ----
  { id: 17, tag: "ALKANES", h: 709632,
    t: "They taught the coins to run.",
    b: "Alkanes is a metaprotocol — tokens and contract logic encoded into ordinary Bitcoin transactions, carried in the witness data Taproot opened up. The base chain does not know it is running anything. It just validates, as it always has.",
    k: "Alkanes · smart-contract metaprotocol on Bitcoin" },
  { id: 18, tag: "SUBFROST", h: null,
    t: "Wrapping me was always the hard part.",
    b: "Every bridge that moved bitcoin somewhere else asked you to trust a custodian. Subfrost's answer is to not leave — keep the asset on Bitcoin and let the protocol layer do the moving. The ice never has to melt to be useful.",
    k: "Subfrost · BTC DeFi native to Bitcoin, not bridged off it" },
  { id: 19, tag: "frBTC", h: null,
    t: "A receipt is only as good as the thing behind it.",
    b: "frBTC is bitcoin represented inside the alkanes layer so contracts can hold and move it. The whole design question is the same one I faced: can anyone verify the backing without asking permission? If not, it is a promise, not a receipt.",
    k: "frBTC · BTC inside the alkanes layer · verify the backing" },
  { id: 20, tag: "dxBTC", h: null,
    t: "Yield is somebody else's risk, wearing a percentage.",
    b: "dxBTC is the yield-bearing form — bitcoin that earns while it sits. I have no objection to it. I only insist you can name where the yield comes from before you take it, because it always comes from somewhere.",
    k: "dxBTC · yield-bearing BTC · always name the source" },
  { id: 21, tag: "FUEL", h: null,
    t: "The work was always the point. Now the work pays twice.",
    b: "FUEL — diesel — is minted by the act of transacting on the alkanes layer. Whoever signs, mines. In this arcade that is the house, which is precisely why you can play without spending a sat. Read that sentence twice before you thank anyone.",
    k: "FUEL / diesel · minted by transacting · the signer mines" },
  { id: 22, tag: "ENVELOPE", h: null,
    t: "I left a space at the end of every transaction.",
    b: "OP_RETURN, and later the witness. Room for data that costs almost nothing and settles with everything else. I did not know what you would put in there. Runes, ordinals, alkanes, a minefield paced by blocks — the seam was the gift.",
    k: "OP_RETURN + witness data · the seam everything grew from" },
  { id: 23, tag: "CUSTODY", h: null,
    t: "Ask what happens when the operator disappears.",
    b: "Every DeFi protocol has a quiet answer to that question, and most would rather you did not ask. A design that survives its own team leaving is the only kind I ever cared about. I tested mine by leaving.",
    k: "Test any protocol against its own team vanishing" },
  { id: 24, tag: "DIESEL", h: null,
    t: "The first thing they built was a way to be paid for building.",
    b: "DIESEL is alkane 2:0 — block two, transaction zero. Not a foundation grant, not a presale. The first slot in the second block of the metaprotocol, mintable by anyone willing to spend a transaction. Whoever signs, mines.",
    k: "DIESEL = AlkaneId 2:0 · minted by transaction, not allocation" },
  { id: 25, tag: "SHADOW", h: null,
    t: "There are outputs you are not allowed to name.",
    b: "An alkanes transaction addresses protostones by shadow index — zero is the transfer, one the first call. The real output numbers are never yours to write. The builder decides the layout, because a hand-written number for one could never be right.",
    k: "shadow index n → real vout = real_outputs + 1 + n" },
  { id: 26, tag: "REVERT", h: null,
    t: "Mined is not the same as worked.",
    b: "A protostone can revert and the transaction still confirms. The block does not care that your call failed — it only cares that the bytes were valid. Read the trace, or pay out on something that never happened.",
    k: "confirmed ≠ succeeded · check ok before crediting anything" },
  { id: 27, tag: "PACKAGE", h: null,
    t: "A child can pay for its parent.",
    b: "Wrap and swap arrive together or not at all — submitted as one package, judged on the combined fee rate. A parent paying under the minimum still relays when the child covers the deficit. Transactions that spend outputs no node has yet seen.",
    k: "CPFP package · parent before child, mined together" },
  { id: 28, tag: "SIGNER", h: null,
    t: "Never write down where to send the money.",
    b: "The frBTC signer is looked up, not remembered. Anything you hardcode becomes a promise you cannot revise — and the one thing worse than a rotating address is a stale one baked into ten thousand clients.",
    k: "frBTC signer resolved live · never hardcoded" },
  { id: 29, tag: "COMMIT", h: null,
    t: "Publish the hash before you deal the cards.",
    b: "A game that generates its own board where the player can read it is not a game, it is a courtesy. Commit to the layout before play opens, reveal after the block, let anyone recompute the hash. Fairness is a thing you can check, or it is a thing you are asserting.",
    k: "commit–reveal · SHA256(layout ‖ nonce ‖ height), published first" },
];

const MILESTONE_KEYS = ["firstPick", "firstWin", "firstBust", "firstGlacier", "firstCashout", "firstKots", "firstCore", "firstDog"];

// ---- ghost terminal card ----
function Transmission({ tx, onClose, onNext, index, total }) {
  const [typed, setTyped] = useState("");
  // Default to a compact dock card: a transmission must never cover a live board.
  // The player opens the full read deliberately, which is when an overlay is fair.
  const [open, setOpen] = useState(false);
  const full = tx.b;
  useEffect(() => {
    if (!open) return;
    setTyped("");
    let i = 0;
    const iv = setInterval(() => {
      i += 3;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [full, open]);

  if (!open) return (
    <div className="ghost-dock" onClick={() => setOpen(true)}>
      <div className="gd-head">
        <span className="gd-dot"/><span className="gd-dot"/><span className="gd-dot"/>
        <span className="gd-from">INCOMING · {tx.tag}</span>
        <button className="gd-x" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
      </div>
      <div className="gd-title">{tx.t}</div>
      <div className="gd-cta">▸ READ · signed <b>S.N.</b></div>
    </div>
  );

  return (
    <div className="ghost-veil" onClick={() => setOpen(false)}>
      <div className="ghost-card" onClick={(e) => e.stopPropagation()}>
        <div className="ghost-scan"/>
        <div className="ghost-head">
          <span className="ghost-from">▸ INCOMING TRANSMISSION</span>
          <span className="ghost-tag">{tx.tag}</span>
        </div>
        <div className="ghost-sig">
          <span className="gs-dot"/><span className="gs-dot"/><span className="gs-dot"/>
          <span className="gs-txt">
            origin unresolved · signed <b>S.N.</b>{tx.h !== null ? ` · block ${tx.h.toLocaleString()}` : " · block unknown"}
          </span>
        </div>
        <div className="ghost-title">{tx.t}</div>
        <div className="ghost-body">{typed}<span className="ghost-caret"/></div>
        <div className="ghost-fact">
          <span className="gf-label">ON THE RECORD</span>
          <span>{tx.k}</span>
        </div>
        <div className="ghost-foot">
          <span className="dimmer" style={{ fontFamily: "var(--f-term)", fontSize: 13 }}>
            {index + 1} of {total} recovered
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm ghost" onClick={() => setOpen(false)}>minimise</button>
            <button className="btn sm ghost" onClick={onClose}>close</button>
            <button className="btn sm" onClick={onNext}>next ▸</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- archive panel ----
function TransmissionArchive({ found, onOpen }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>▸ transmissions</span>
        <span>{found.length}/{TRANSMISSIONS.length}</span>
      </div>
      <div className="panel-body" style={{ padding: 10 }}>
        <div className="tx-grid">
          {TRANSMISSIONS.map((t, i) => {
            const got = found.includes(t.id);
            return (
              <button key={t.id} className="tx-cell" data-got={got ? "1" : undefined}
                      onClick={() => got && onOpen(i)} title={got ? t.t : "not yet recovered"}>
                <span className="tx-n">{String(t.id).padStart(2, "0")}</span>
                <span className="tx-tag">{got ? t.tag : "· · ·"}</span>
              </button>
            );
          })}
        </div>
        <div className="ft dim" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>
          Fragments surface as you play. Each one is a real piece of Bitcoin's record,
          read back to you by something that claims to have written it.
        </div>
      </div>
    </div>
  );
}

// ---- hook: decides when a transmission arrives ----
function useSatoshi(active, { blocksSeen, milestones }) {
  const [found, setFound] = useState([1]);
  const [openIx, setOpenIx] = useState(null);
  const firedRef = useRef(new Set());
  const foundRef = useRef(found);
  foundRef.current = found;

  // milestone-driven reveals
  useEffect(() => {
    if (!active) return;
    for (const m of MILESTONE_KEYS) {
      if (milestones[m] && !firedRef.current.has(m)) {
        firedRef.current.add(m);
        reveal();
      }
    }
  }, [active, milestones]);

  // every 3rd block, a fragment
  useEffect(() => {
    if (!active || !blocksSeen) return;
    if (blocksSeen % 3 !== 0) return;
    const key = "blk" + blocksSeen;
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);
    reveal();
  }, [active, blocksSeen]);

  function reveal() {
    const have = foundRef.current;
    const next = TRANSMISSIONS.find((t) => !have.includes(t.id));
    if (!next) return;
    setFound((f) => [...f, next.id]);
    setOpenIx(TRANSMISSIONS.findIndex((t) => t.id === next.id));
    window.FBLog && FBLog.event("satoshi-transmission", { id: next.id, tag: next.tag });
  }

  return {
    found, openIx, setOpenIx,
    open: (i) => setOpenIx(i),
    close: () => setOpenIx(null),
    next: () => setOpenIx((i) => {
      const order = TRANSMISSIONS.map((t, k) => foundRef.current.includes(t.id) ? k : -1).filter((k) => k >= 0);
      const at = order.indexOf(i);
      return order[(at + 1) % order.length];
    }),
  };
}

Object.assign(window, { TRANSMISSIONS, Transmission, TransmissionArchive, useSatoshi });
})();
