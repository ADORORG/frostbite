import type { BroadcastOutcome, Observation } from "./results.ts";
import type { SignedTransaction, UnsignedTransaction } from "./transaction.ts";
import { canTransition, type TransactionState } from "./transaction-state.ts";

// Where a claim goes next. The neutral lifecycle allows no jumps, so each move is walked one legal step at a time and the claim
// is written at the end of the walk; a mistake in a path fails loudly in a test, not quietly in a player's claim.
export function walk(path: readonly TransactionState[]): void {
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (from === undefined || to === undefined || !canTransition(from, to))
      throw new Error(
        `Illegal transaction transition ${String(from)} -> ${String(to)}.`,
      );
  }
}

// The way a broadcast claim goes when nothing goes wrong.
const forward = [
  "broadcast_unknown",
  "broadcast_accepted",
  "pending",
  "confirmed",
] as const satisfies readonly TransactionState[];
walk(forward);

// What indexing adds once the chain's own state shows the claim: indexed, reconciled with the platform's record, complete.
const indexing = [
  "confirmed",
  "indexed_success",
  "reconciled",
  "complete",
] as const satisfies readonly TransactionState[];
walk(indexing);
walk(["confirmed", "indexed_failure"]);

// Every move a claim may be written as in one step: the lifecycle's own single steps, and the ends of the walks above.
const walked = new Set<string>();
for (let from = 0; from < forward.length; from += 1) {
  for (let to = from + 1; to < forward.length; to += 1)
    walked.add(`${String(forward[from])}>${String(forward[to])}`);
  walked.add(`${String(forward[from])}>indexed_failure`);
}
walked.add("confirmed>complete");

export const canMove = (
  from: TransactionState,
  to: TransactionState,
): boolean => canTransition(from, to) || walked.has(`${from}>${to}`);

// The states in which a claim has been sent and the network is asked about it.
export const observable = [
  "broadcast_unknown",
  "broadcast_accepted",
  "pending",
] as const;
export const isObservable = (
  state: string,
): state is (typeof observable)[number] =>
  (observable as readonly string[]).includes(state);

export type Next =
  | { readonly state: TransactionState }
  | { readonly failureReason: string; readonly state: "indexed_failure" }
  | null;

const position = (state: TransactionState) =>
  (forward as readonly TransactionState[]).indexOf(state);

// The state an observation moves a claim in `from` to, or null when it changes nothing: not found (the network has not shown
// the transaction yet, and one of unknown outcome stays unknown until it does), or no further than the claim already is.
export function afterObservation(
  from: TransactionState,
  observation: Pick<Observation, "status">,
): Next {
  const start = position(from);
  if (start === -1 || observation.status === "not-found") return null;
  // The network included it and its execution failed: it was confirmed to have failed, then indexed as a failure.
  if (observation.status === "reverted")
    return {
      failureReason: "reverted by the network",
      state: "indexed_failure",
    };
  const target = observation.status === "pending" ? "pending" : "confirmed";
  return start < position(target) ? { state: target } : null;
}

// What a confirmed claim becomes when the chain's indexed state shows it (the end of the walk checked above).
export const indexed = "complete" as const satisfies TransactionState;

export type BroadcastChange =
  | {
      readonly state: "broadcast_accepted" | "broadcast_unknown";
      readonly transactionId: string;
    }
  | { readonly failureReason: string; readonly state: "broadcast_rejected" };

// What a broadcast attempt does to a signed transaction; null when the network could not be asked at all, so nothing moves and
// the same bytes are sent again later (the network gives the same id).
export function afterBroadcast(
  outcome: BroadcastOutcome,
): BroadcastChange | null {
  switch (outcome.kind) {
    case "accepted":
      return { state: "broadcast_accepted", transactionId: outcome.ref.id };
    case "ambiguous":
      return { state: "broadcast_unknown", transactionId: outcome.ref.id };
    case "rejected":
      return { failureReason: outcome.reason, state: "broadcast_rejected" };
    case "unavailable":
      return null;
  }
}

// The state of a transaction the platform tracks: the neutral ones, and `expired` for one built and never signed in time.
export type TrackedState = TransactionState | "expired";

// The transaction a step was signed as, or null while it is unsigned.
export const signedOf = (step: {
  readonly signedPayload: string | null;
  readonly unsigned: UnsignedTransaction;
}): SignedTransaction | null =>
  step.signedPayload === null
    ? null
    : {
        chain: step.unsigned.chain,
        family: step.unsigned.family,
        format: step.unsigned.format,
        payload: step.signedPayload,
      };

// A change is written only if the lifecycle allows the move from where the step is now; otherwise nothing is written, so a step
// that arrives late (or twice) cannot move a transaction backwards or sideways.
export const moveTo =
  <Change extends { readonly state: TrackedState }>(
    from: TransactionState,
    change: Change,
  ) =>
  (step: { readonly state: TrackedState }): Change | null =>
    step.state === from &&
    change.state !== "expired" &&
    canMove(from, change.state)
      ? change
      : null;
