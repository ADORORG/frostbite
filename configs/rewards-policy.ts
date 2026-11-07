import {
  assertFeeSpeedPolicy,
  targetBlocksOf,
  type FeeSpeed,
  type FeeSpeedPolicy,
} from "@frostbite/shared/chain";

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

// How long one reading of the chain is shared by everyone who asks, however it is shown (see `indexingReadingMs`, `statusReadings`).
const readingSharedMs = 15_000;

// The oldest reading of the chain status that is shown anywhere: the server stops serving one this old, and a page stops showing one this old.
const statusMaxStaleMs = 10 * 60_000;

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
  // The most the platform's fee on one milestone claim may be set to, in satoshis: a guard against a slip of the keyboard when staff
  // set it (0.001 BTC). Raising it is a change of policy, made here.
  maxPlatformFeeSats: 100_000n,
  // When a wait is called delayed rather than ordinary (ADR-018): the indexer is more than this many blocks behind the chain's tip, or a
  // sent step or claim has gone this long without finishing. Delayed is shown, never as failed, and nothing is retried or cancelled.
  delay: { maxLagBlocks: 2, maxUnsettledMs: 60 * 60 * 1000 },
  defaultFeeSpeed,
  // How large the smallest step is, in virtual bytes: the size a speed is tested at to tell whether any step could afford it. Never shown as a cost, and not a
  // quote: the platform prices the real transaction when it builds it, and the page tells a cost only for a step already built.
  smallestStepVbytes: 200,
  feeSpeeds,
  // How long one reading of the indexer is reused. Every page of the site shows it, so the node is asked at most once in this time
  // however many people are looking; a reading is never older than this.
  indexingReadingMs: readingSharedMs,
  // What the public status (the header pill, the fee speeds) shows of the chain: one reading is shared by every visitor for `freshMs`; if
  // the node then fails or is slow, the last reading is still shown, with its age, for up to `maxStaleMs`, and then not at all.
  statusReadings: { freshMs: readingSharedMs, maxStaleMs: statusMaxStaleMs },
  // How a page follows the chain status: it asks again every `refreshMs` (longer than a reading is reused, so most asks cost the node
  // nothing), and stops showing a reading older than `forgetAfterMs`, the same limit the server serves by.
  statusPolling: { forgetAfterMs: statusMaxStaleMs, refreshMs: 30_000 },
  // The sync bar spans this many of the latest blocks: an indexer this far behind or more shows as 0%, one at the tip as 100%. Over the whole
  // chain's height the bar would read 100% for any lag under a few thousand blocks.
  syncWindowBlocks: 100,
  // How long a built transaction may be signed for. Staff sign each step by hand after reading its summary, so it is generous.
  lifetimeMs: 30 * 60 * 1000,
  // The largest collectible picture the platform will read back from a chain for display; not below the largest drawing a contract
  // may be created to accept, or a drawing the platform allowed could not be shown.
  maxPreviewBytes: 16_384,
  // What a template's code may weigh uncompressed, checked before it is unpacked. The released templates are below it (the largest is
  // 294,119 bytes). Set so that even code that does not compress at all, sent as it is, builds a publish step under the 100,000 vB
  // Bitcoin relays (about 82,000 vB at this size); a test builds that step.
  maxTemplateCodeBytes: 320 * 1024,
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
  // Where a new template is published: an address is drawn at random in the chain's code block, from a range starting at `first` and
  // `window` wide, then from ranges twice as wide for each further attempt, until one is free or `attempts` are used. The low,
  // round numbers are the ones other deployers use first (4:1000 was already taken on signet), and a sequence anyone can predict is
  // one anyone can occupy ahead of a publish; a random draw from a wide, high range is neither. Ten attempts reach 512 times the
  // window (finding S107).
  templateSequence: { attempts: 10, first: 1_000_000n, window: 1_000_000n },
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
