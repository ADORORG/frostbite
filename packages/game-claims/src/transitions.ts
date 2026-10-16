import {
  canTransition,
  type Observation,
  type TransactionState,
} from "@ador/shared/chain";

// Where a claim goes next. The neutral lifecycle allows no jumps, so each move is walked one legal step at a time and the claim
// is written at the end of the walk; a mistake in a path fails loudly in a test, not quietly in a player's claim.
export function walk(path: readonly TransactionState[]): void {
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (from === undefined || to === undefined || !canTransition(from, to))
      throw new Error(
        `Illegal claim transition ${String(from)} -> ${String(to)}.`,
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
