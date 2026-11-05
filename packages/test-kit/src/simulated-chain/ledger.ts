import { createHash } from "node:crypto";

import type {
  BlockRef,
  BroadcastOutcome,
  ChainRef,
  Observation,
  TransactionRef,
} from "@frostbite/shared/chain";

import { decodeSimulated } from "./transaction.ts";

export type ForcedBroadcast = "rejected" | "unavailable" | "ambiguous";

export const defaultFinalityDepth = 3;

// What a simulated deployment's contract id starts with, followed by the transaction's nonce.
export const createdContractPrefix = "sim-game-";

// Deterministic in-memory chain state: heights advance only when a test says so, and a broadcast
// outcome can be forced, which is how the simulated family exercises the paths a real network only
// produces by accident. A transaction is `pending` until `finalityDepth` blocks have passed, then
// `confirmed`; there is no partial finality in between.
export class SimulatedLedger {
  private height = 100;
  private forced: ForcedBroadcast | undefined;
  // Transaction id to the height at which the network first saw it, and what it carried.
  private readonly entries = new Map<
    string,
    { readonly payload: string; readonly seenAt: number }
  >();
  // Transactions the network included and then reverted: seen, but without effect.
  private readonly reverted = new Set<string>();

  constructor(
    private readonly chain: ChainRef,
    private readonly now: () => Date,
    private readonly finalityDepth: number,
  ) {}

  advance(blocks: number): void {
    this.height += blocks;
  }

  // The network included this transaction and its execution failed: observed as reverted from then on.
  revert(ref: TransactionRef): void {
    if (!this.entries.has(ref.id))
      throw new Error("Only a transaction the network has seen can revert.");
    this.reverted.add(ref.id);
  }

  // Payloads of the transactions that took effect: included, past the finality depth, and not reverted.
  effective(): readonly string[] {
    return [...this.entries.entries()]
      .filter(
        ([id, { seenAt }]) =>
          !this.reverted.has(id) && this.height - seenAt >= this.finalityDepth,
      )
      .map(([, { payload }]) => payload);
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
    if (!this.entries.has(ref.id))
      this.entries.set(ref.id, { payload, seenAt: this.height });
    return outcome === "ambiguous"
      ? { kind: "ambiguous", ref }
      : { kind: "accepted", ref };
  }

  observe(ref: TransactionRef): Observation {
    const observedAt = this.now().toISOString();
    const seen = this.entries.get(ref.id);
    const base = { observedAt, provider: "simulated", ref };
    if (seen === undefined)
      return { ...base, confirmations: 0, status: "not-found" };
    const confirmations = this.height - seen.seenAt;
    const block = this.block(seen.seenAt);
    if (this.reverted.has(ref.id))
      return { ...base, block, confirmations, status: "reverted" };
    return confirmations >= this.finalityDepth
      ? {
          ...base,
          block,
          confirmations,
          ...this.created(seen.payload),
          status: "confirmed",
        }
      : { ...base, block, confirmations, status: "pending" };
  }

  // A deployment creates the game's contract, named after the transaction that made it.
  private created(payload: string): { readonly created?: readonly string[] } {
    const body = decodeSimulated(payload);
    return body?.operation === "deploy"
      ? { created: [`${createdContractPrefix}${body.nonce}`] }
      : {};
  }

  private block(height: number): BlockRef {
    const hash = createHash("sha256")
      .update(`${this.chain}:${height}`)
      .digest("hex");
    return { chain: this.chain, hash, height };
  }
}
