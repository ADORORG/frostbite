import {
  assertFeeSpeedPolicy,
  targetBlocksOf,
  type FeeSpeed,
  type FeeSpeedPolicy,
} from "@ador/shared/chain";

import release from "../contracts/templates/release.json" with { type: "json" };

// The speeds a person chooses between when they pay a fee, each a block target (the rate the node quotes for confirming within that
// many blocks) and an honest wait. They apply to every network the policy serves; a mainnet record would need its own. Slow is 25 blocks
// (owner's decision, 2026-10-23): the testnet4 gateway quotes 588,235 sat/vB for any target under 13 blocks and about 1 sat/vB from 25,
// and test coins cost nothing to wait on. Lightning is the next block, told as about 15 minutes because blocks come at ten minutes
// on average and the next one is not promised. The waits are told to people as estimates, never as promises.
const feeSpeeds: FeeSpeedPolicy = {
  fast: { approxMinutes: 30, targetBlocks: 3 },
  lightning: { approxMinutes: 15, targetBlocks: 1 },
  medium: { approxMinutes: 60, targetBlocks: 6 },
  slow: { approxMinutes: 250, targetBlocks: 25 },
};
assertFeeSpeedPolicy(feeSpeeds);

// The speed a step or claim is built at when no one chose another.
const defaultFeeSpeed: FeeSpeed = "slow";

// The block target of the default speed, for what is built without a choice.
export const defaultFeeTargetBlocks = targetBlocksOf(
  feeSpeeds,
  defaultFeeSpeed,
);

// The rules the platform follows on its rewards chain, as typed policy. What differs between deployments (the node, the fee
// ceiling, where templates and contracts are) is configuration (`REWARDS_*`, see `.env.example`); these are decisions.
export const rewardsPolicy = {
  // Below this a change output is not worth making; the remainder is paid as fee. The relay dust limit of the smallest output
  // the wallets use (P2WPKH), per Bitcoin Core's policy.
  changeDustSats: 294n,
  // What a claim's collectible output carries: above the dust limit of a P2TR output so the collectible has somewhere to land.
  claimOutputSats: 546n,
  // When a wait is called delayed rather than ordinary (ADR-018): the indexer is more than this many blocks behind the chain's tip, or a
  // sent step or claim has gone this long without finishing. Delayed is shown, never as failed, and nothing is retried or cancelled.
  delay: { maxLagBlocks: 2, maxUnsettledMs: 60 * 60 * 1000 },
  defaultFeeSpeed,
  // About how large an everyday transaction (a player's claim) is, in virtual bytes, for the example cost the fee panel shows. Not a
  // quote: the platform prices the real transaction when it builds it.
  exampleTransactionVbytes: 200,
  feeSpeeds,
  // How long one reading of the indexer is reused. Every page of the site shows it, so the node is asked at most once in this time
  // however many people are looking; a reading is never older than this.
  indexingReadingMs: 15_000,
  // How often a page asks again how far the indexer has read. Longer than a reading is reused, so most asks cost the node nothing.
  indexingRefreshMs: 30_000,
  // How long a built transaction may be signed for. Staff sign each step by hand after reading its summary, so it is generous.
  lifetimeMs: 30 * 60 * 1000,
  // The largest collectible picture the platform will read back from a chain for display; not below the largest drawing a contract
  // may be created to accept, or a drawing the platform allowed could not be shown.
  maxPreviewBytes: 16_384,
  // What a template's code may weigh uncompressed, checked before it is unpacked; the released templates are well below it.
  maxTemplateCodeBytes: 512 * 1024,
  // The most a new game's contract may be created to accept; staff choose within it when they create the contract.
  maxDrawingBytes: 16_384n,
  // Whether the platform may build, send and watch transactions on the beta's test network (signet or testnet4, ADR-018 and ADR-019).
  // It is open; a mainnet record is added closed and opened by the owner after review, as an edit to this file.
  testChainReleaseGate: "open",
  // The wallets (LaserEyes provider ids) staff may sign administration steps with from the page. Chosen by the owner; each still
  // needs qualification evidence (packages/wallet README) before it is relied on for real funds.
  signingWallets: ["xverse", "unisat", "oyl"],
  // The confirmations after which a step is done on the beta's test network (ADR-018, D22); the indexer must also have run it.
  testChainConfirmations: 1,
  // Where a new template is published: the platform looks for the first free address in the chain's code block from this number, and
  // gives up after this many in a row. 1000 is the figure the platform's predecessor used, well above the low ids the first
  // deployments of a chain tend to hold.
  templateSequence: { attempts: 200, first: 1000n },
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
