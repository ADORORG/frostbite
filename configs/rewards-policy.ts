import release from "../contracts/templates/release.json" with { type: "json" };

// The rules the platform follows on its rewards chain, as typed policy. What differs between deployments (the node, the fee
// ceiling, where templates and contracts are) is configuration (`REWARDS_*`, see `.env.example`); these are decisions.
export const rewardsPolicy = {
  // Below this a change output is not worth making; the remainder is paid as fee. The relay dust limit of the smallest output
  // the wallets use (P2WPKH), per Bitcoin Core's policy.
  changeDustSats: 294n,
  // What a claim's collectible output carries: above the dust limit of a P2TR output so the collectible has somewhere to land.
  claimOutputSats: 546n,
  // The fee rate is taken for confirmation within this many blocks.
  feeTargetBlocks: 3,
  // How long a built transaction may be signed for. Staff sign each step by hand after reading its summary, so it is generous.
  lifetimeMs: 30 * 60 * 1000,
  // The largest collectible picture the platform will read back from a chain for display; not below the largest drawing a contract
  // may be created to accept, or a drawing the platform allowed could not be shown.
  maxPreviewBytes: 16_384,
  // What a template's code may weigh uncompressed, checked before it is unpacked; the released templates are well below it.
  maxTemplateCodeBytes: 512 * 1024,
  // The most a new game's contract may be created to accept; staff choose within it when they create the contract.
  maxDrawingBytes: 16_384n,
  // Whether the platform may build, send and watch transactions on signet. Signet is open (ADR-018: signet first); a mainnet record
  // is added closed and opened by the owner after review, as an edit to this file.
  signetReleaseGate: "open",
  // The wallets (LaserEyes provider ids) staff may sign administration steps with from the page. Chosen by the owner; each still
  // needs qualification evidence (packages/wallet README) before it is relied on for real funds.
  signingWallets: ["xverse", "unisat", "oyl"],
  // The confirmations after which a step is done on signet (ADR-018, D22); the indexer must also have run it.
  signetConfirmations: 1,
  // The templates the platform may publish. Their code hashes are the released ones, so a rebuilt template that differs is
  // refused until a new version is released and listed here.
  templates: [
    {
      codeHash: release["game-rewards"].sha256,
      crate: "game-rewards",
      version: "1.0.0",
    },
    {
      codeHash: release["milestone-collectible"].sha256,
      crate: "milestone-collectible",
      version: "1.0.0",
    },
  ],
} as const;
