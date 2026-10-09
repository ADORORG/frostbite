import { describe, expect, it } from "vitest";

import {
  canTransition,
  isTerminalState,
  nextTransactionStates,
  transactionStates,
  type TransactionState,
} from "../src/chain/index.ts";

describe("transaction state machine", () => {
  const happyPath: readonly TransactionState[] = [
    "constructed",
    "simulated",
    "awaiting_signature",
    "signed",
    "broadcast_accepted",
    "pending",
    "confirmed",
    "indexed_success",
    "reconciled",
    "complete",
  ];

  it("walks the happy path one legal step at a time", () => {
    for (const [index, from] of happyPath.slice(0, -1).entries()) {
      expect(canTransition(from, happyPath[index + 1] ?? from)).toBe(true);
    }
  });

  it("resolves an ambiguous broadcast only by lookup, never by signing again", () => {
    expect(nextTransactionStates("broadcast_unknown")).toEqual([
      "broadcast_accepted",
      "broadcast_rejected",
    ]);
    expect(canTransition("broadcast_unknown", "signed")).toBe(false);
    expect(canTransition("broadcast_unknown", "awaiting_signature")).toBe(
      false,
    );
  });

  it("never skips a state or goes backwards", () => {
    expect(canTransition("signed", "pending")).toBe(false);
    expect(canTransition("confirmed", "complete")).toBe(false);
    expect(canTransition("indexed_failure", "complete")).toBe(false);
    expect(canTransition("pending", "broadcast_accepted")).toBe(false);
    expect(canTransition("complete", "constructed")).toBe(false);
  });

  it("ends only at a rejected broadcast or completion", () => {
    expect(transactionStates.filter(isTerminalState)).toEqual([
      "broadcast_rejected",
      "complete",
    ]);
  });

  it("reaches every state from construction and every path ends terminal", () => {
    const reached = new Set<TransactionState>(["constructed"]);
    const queue: TransactionState[] = ["constructed"];
    for (let state = queue.shift(); state; state = queue.shift()) {
      for (const next of nextTransactionStates(state)) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    expect([...reached].sort()).toEqual([...transactionStates].sort());
    for (const state of transactionStates) {
      expect(nextTransactionStates(state)).not.toContain(state);
    }
  });
});
