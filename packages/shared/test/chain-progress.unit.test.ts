import { describe, expect, it } from "vitest";

import {
  afterObservation,
  canMove,
  indexed,
  isObservable,
  walk,
  afterBroadcast,
  moveTo,
  stageOf,
  trackedStates,
  signedOf,
} from "../src/chain/progress.ts";
import { transactionStates } from "../src/chain/transaction-state.ts";

describe("what an observation does to a claim in the network's hands", () => {
  it.each([
    ["broadcast_unknown", "pending", "pending"],
    ["broadcast_unknown", "confirmed", "confirmed"],
    ["broadcast_accepted", "pending", "pending"],
    ["broadcast_accepted", "confirmed", "confirmed"],
    ["pending", "confirmed", "confirmed"],
  ] as const)("%s seen %s becomes %s", (from, status, state) => {
    expect(afterObservation(from, { status })).toEqual({ state });
  });

  it.each([
    ["broadcast_unknown", "not-found"],
    ["broadcast_accepted", "not-found"],
    ["pending", "not-found"],
    ["pending", "pending"],
    ["confirmed", "pending"],
    ["confirmed", "confirmed"],
    ["complete", "confirmed"],
    ["signed", "confirmed"],
    ["awaiting_signature", "pending"],
    ["broadcast_rejected", "reverted"],
  ] as const)("%s seen %s changes nothing", (from, status) => {
    expect(afterObservation(from, { status })).toBeNull();
  });

  it.each(["broadcast_unknown", "broadcast_accepted", "pending"] as const)(
    "%s seen reverted becomes a failure with its reason",
    (from) => {
      expect(afterObservation(from, { status: "reverted" })).toEqual({
        failureReason: "reverted by the network",
        state: "indexed_failure",
      });
    },
  );

  it("never moves a claim to a state it came from or past one it has reached", () => {
    for (const from of ["pending", "confirmed"] as const)
      expect(afterObservation(from, { status: "pending" })).toBeNull();
  });
});

describe("the moves a claim may be written as", () => {
  it("allows the lifecycle's single steps and the ends of the walks, and nothing else", () => {
    expect(canMove("awaiting_signature", "signed")).toBe(true);
    expect(canMove("signed", "broadcast_accepted")).toBe(true);
    expect(canMove("broadcast_unknown", "confirmed")).toBe(true);
    expect(canMove("pending", "indexed_failure")).toBe(true);
    expect(canMove("confirmed", indexed)).toBe(true);
    expect(canMove("complete", "pending")).toBe(false);
    expect(canMove("confirmed", "pending")).toBe(false);
    expect(canMove("awaiting_signature", "complete")).toBe(false);
    expect(canMove("broadcast_rejected", "signed")).toBe(false);
  });

  it("knows only states the lifecycle has", () => {
    for (const state of transactionStates)
      expect(typeof canMove(state, state)).toBe("boolean");
    expect(indexed).toBe("complete");
  });

  it("asks the network about a claim only after it was sent and before it is confirmed", () => {
    expect(
      ["broadcast_unknown", "broadcast_accepted", "pending"].every(
        isObservable,
      ),
    ).toBe(true);
    for (const state of [
      "signed",
      "confirmed",
      "complete",
      "expired",
      "awaiting_signature",
    ])
      expect(isObservable(state)).toBe(false);
  });
});

describe("a walk through the lifecycle", () => {
  it("accepts a path of legal steps and refuses one that skips a state", () => {
    expect(() =>
      walk(["awaiting_signature", "signed", "broadcast_accepted"]),
    ).not.toThrow();
    expect(() => walk(["awaiting_signature", "broadcast_accepted"])).toThrow(
      "Illegal transaction transition awaiting_signature -> broadcast_accepted.",
    );
    expect(() => walk(["complete", "pending"])).toThrow(
      /Illegal transaction transition/u,
    );
    expect(() => walk([])).not.toThrow();
    expect(() => walk(["signed"])).not.toThrow();
  });
});

describe("what a broadcast does to a signed transaction", () => {
  const ref = { chain: "simnet:one" as never, id: "abc" };
  it("records the id when the network has it, or may have it", () => {
    expect(afterBroadcast({ kind: "accepted", ref })).toEqual({
      state: "broadcast_accepted",
      transactionId: "abc",
    });
    expect(afterBroadcast({ kind: "ambiguous", ref })).toEqual({
      state: "broadcast_unknown",
      transactionId: "abc",
    });
  });
  it("records a refusal with its reason, and nothing when the network could not be asked", () => {
    expect(afterBroadcast({ kind: "rejected", reason: "no" })).toEqual({
      failureReason: "no",
      state: "broadcast_rejected",
    });
    expect(afterBroadcast({ kind: "unavailable" })).toBeNull();
  });
});

describe("moving a tracked transaction", () => {
  const change = { state: "pending" } as const;
  it("moves it only from the state it was decided in, and only where the lifecycle allows", () => {
    expect(
      moveTo("broadcast_accepted", change)({ state: "broadcast_accepted" }),
    ).toBe(change);
    expect(
      moveTo("broadcast_accepted", change)({ state: "pending" }),
    ).toBeNull();
    expect(moveTo("signed", change)({ state: "signed" })).toBeNull();
    expect(
      moveTo("signed", { state: "expired" })({ state: "signed" }),
    ).toBeNull();
  });

  it("reads a transaction as signed once it has a signed payload", () => {
    const unsigned = {
      chain: "simnet:one" as never,
      family: "simulated" as never,
      format: "f",
      payload: "p",
      summary: {} as never,
    };
    expect(signedOf({ signedPayload: null, unsigned })).toBeNull();
    expect(signedOf({ signedPayload: "s", unsigned })).toEqual({
      chain: unsigned.chain,
      family: unsigned.family,
      format: "f",
      payload: "s",
    });
  });
});

describe("where a tracked transaction stands for the person waiting", () => {
  it("places every state in one of six stages", () => {
    expect([...new Set(trackedStates.map(stageOf))].sort()).toEqual([
      "awaiting-signature",
      "complete",
      "confirmed",
      "expired",
      "failed",
      "pending",
    ]);
    expect(trackedStates).toHaveLength(14);
  });

  it("never calls a transaction complete before the indexed state agrees", () => {
    expect(
      trackedStates.filter((state) => stageOf(state) === "complete"),
    ).toEqual(["complete"]);
    expect(stageOf("confirmed")).toBe("confirmed");
  });
});
