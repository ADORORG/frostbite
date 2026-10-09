// The neutral transaction lifecycle (ADR-017 section 5, generalising ADR-008). No state is a Bitcoin
// term: `pending` is whatever the adapter maps its own "seen but not final" concept onto.
export const transactionStates = [
  "constructed",
  "simulated",
  "awaiting_signature",
  "signed",
  "broadcast_unknown",
  "broadcast_accepted",
  "broadcast_rejected",
  "pending",
  "confirmed",
  "indexed_success",
  "indexed_failure",
  "reconciled",
  "complete",
] as const;

export type TransactionState = (typeof transactionStates)[number];

// Every legal move. `broadcast_unknown` resolves only by looking the transaction up by id, never by
// signing or sending again. `complete` means indexed chain state agrees with the expected result.
const transitions: Readonly<
  Record<TransactionState, readonly TransactionState[]>
> = {
  awaiting_signature: ["signed"],
  broadcast_accepted: ["pending"],
  broadcast_rejected: [],
  broadcast_unknown: ["broadcast_accepted", "broadcast_rejected"],
  complete: [],
  confirmed: ["indexed_success", "indexed_failure"],
  constructed: ["simulated"],
  indexed_failure: ["reconciled"],
  indexed_success: ["reconciled"],
  pending: ["confirmed"],
  reconciled: ["complete"],
  signed: ["broadcast_accepted", "broadcast_rejected", "broadcast_unknown"],
  simulated: ["awaiting_signature"],
};

export function nextTransactionStates(
  state: TransactionState,
): readonly TransactionState[] {
  return transitions[state];
}

export function canTransition(
  from: TransactionState,
  to: TransactionState,
): boolean {
  return transitions[from].includes(to);
}

export function isTerminalState(state: TransactionState): boolean {
  return transitions[state].length === 0;
}
