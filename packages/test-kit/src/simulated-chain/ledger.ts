import { createHash } from "node:crypto";

import type {
  BlockRef,
  BroadcastOutcome,
  ChainRef,
  Observation,
  TransactionRef,
} from "@ador/shared/chain";

export type ForcedBroadcast = "rejected" | "unavailable" | "ambiguous";

export const defaultFinalityDepth = 3;

// Deterministic in-memory chain state: heights advance only when a test says so, and a broadcast
// outcome can be forced, which is how the simulated family exercises the paths a real network only
// produces by accident. A transaction is `pending` until `finalityDepth` blocks have passed, then
// `confirmed`; there is no partial finality in between.
export class SimulatedLedger {
  private height = 100;
  private forced: ForcedBroadcast | undefined;
  // Transaction id to the height at which the network first saw it.
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly chain: ChainRef,
    private readonly now: () => Date,
    private readonly finalityDepth: number,
  ) {}

  advance(blocks: number): void {
    this.height += blocks;
  }

  failNext(outcome: ForcedBroadcast): void {
    this.forced = outcome;
  }

  head(): BlockRef {
    return this.block(this.height);
  }

  transactionRef(payload: string): TransactionRef {
    const id = createHash("sha256").update(payload).digest("hex").slice(0, 32);
    return { chain: this.chain, id };
  }

  broadcast(payload: string): BroadcastOutcome {
    const ref = this.transactionRef(payload);
    const outcome = this.forced;
    this.forced = undefined;
    if (outcome === "unavailable") return { kind: "unavailable" };
    if (outcome === "rejected")
      return { kind: "rejected", reason: "rejected by the simulated network" };
    // An ambiguous broadcast still reaches the network; the caller cannot tell and must look it up.
    if (!this.entries.has(ref.id)) this.entries.set(ref.id, this.height);
    return outcome === "ambiguous"
      ? { kind: "ambiguous", ref }
      : { kind: "accepted", ref };
  }

  observe(ref: TransactionRef): Observation {
    const observedAt = this.now().toISOString();
    const seenAt = this.entries.get(ref.id);
    const base = { observedAt, provider: "simulated", ref };
    if (seenAt === undefined)
      return { ...base, confirmations: 0, status: "not-found" };
    const confirmations = this.height - seenAt;
    const block = this.block(seenAt);
    return confirmations >= this.finalityDepth
      ? { ...base, block, confirmations, status: "confirmed" }
      : { ...base, block, confirmations, status: "pending" };
  }

  private block(height: number): BlockRef {
    const hash = createHash("sha256")
      .update(`${this.chain}:${height}`)
      .digest("hex");
    return { chain: this.chain, hash, height };
  }
}
