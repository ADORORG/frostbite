import { z } from "zod";

import { chainRefTextSchema } from "./chain-ref.ts";
import type { TransactionStage } from "./progress.ts";

// How far the chain's indexer has read, against the chain's own tip, as a provider saw it at one moment. The indexer is what turns
// a transaction in a block into the chain's state (a contract, a collectible), so a platform record is only as current as it is.
export const indexingStatusSchema = z
  .object({
    chain: chainRefTextSchema,
    indexedHeight: z.number().int().nonnegative(),
    observedAt: z.iso.datetime({ offset: true }),
    tipHeight: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();

export type IndexingStatus = z.infer<typeof indexingStatusSchema>;

// When the platform calls a wait "delayed" (ADR-018): the indexer is more than this many blocks behind the tip, or a sent
// transaction has gone this long without finishing. Both are decisions, so they come from policy and are never written here.
export interface DelayPolicy {
  readonly maxLagBlocks: number;
  readonly maxUnsettledMs: number;
}

// The blocks the indexer has yet to read. An indexer reported ahead of the tip (two providers a block apart) is not behind.
export const lagOf = (
  status: Pick<IndexingStatus, "indexedHeight" | "tipHeight">,
): number => Math.max(0, status.tipHeight - status.indexedHeight);

// What a person is told of the indexer: it has read everything, it is catching up within what is normal, or it is far enough
// behind that what depends on it is delayed.
export const indexingHealths = ["current", "catching-up", "delayed"] as const;
export type IndexingHealth = (typeof indexingHealths)[number];

export function indexingHealth(
  status: Pick<IndexingStatus, "indexedHeight" | "tipHeight">,
  policy: Pick<DelayPolicy, "maxLagBlocks">,
): IndexingHealth {
  const lag = lagOf(status);
  if (lag === 0) return "current";
  return lag > policy.maxLagBlocks ? "delayed" : "catching-up";
}

// The stages in which a transaction has been sent and is not yet done: the only ones that can be delayed. A transaction waiting for
// a signature, finished, failed or lapsed is not waiting on the network.
const waiting: readonly TransactionStage[] = ["pending", "confirmed"];
export const isWaiting = (stage: TransactionStage): boolean =>
  waiting.includes(stage);

// Whether a sent transaction is delayed: it is waiting on the network and either the indexer it waits for is further behind than
// the policy allows, or it was sent longer ago than the policy allows. Delayed is a statement about the wait, never about the
// outcome: it is not failure, and the transaction can still complete. `status` is null where the indexer could not be asked, in
// which case only the time can say.
export function isDelayed(input: {
  readonly now: Date;
  readonly policy: DelayPolicy;
  readonly sentAt: Date | null;
  readonly stage: TransactionStage;
  readonly status: Pick<IndexingStatus, "indexedHeight" | "tipHeight"> | null;
}): boolean {
  const { now, policy, sentAt, stage, status } = input;
  if (!isWaiting(stage)) return false;
  if (status !== null && indexingHealth(status, policy) === "delayed")
    return true;
  return (
    sentAt !== null && now.getTime() - sentAt.getTime() > policy.maxUnsettledMs
  );
}

// When a transaction was first sent, after a change: the time it had, or `at` when this change is the one that brings the network's
// id for it. Later changes (observations) never move it, so a wait is counted from the send and not from the latest news.
export const sentAtAfter = (
  held: Date | null,
  change: { readonly transactionId?: string | undefined },
  at: Date,
): Date | null => held ?? (change.transactionId === undefined ? null : at);
