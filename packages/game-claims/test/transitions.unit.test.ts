import { transactionStates } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import {
  afterObservation,
  canMove,
  indexed,
  isObservable,
  walk,
} from "../src/transitions.ts";

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
      "Illegal claim transition awaiting_signature -> broadcast_accepted.",
    );
    expect(() => walk(["complete", "pending"])).toThrow(
      /Illegal claim transition/u,
    );
    expect(() => walk([])).not.toThrow();
    expect(() => walk(["signed"])).not.toThrow();
  });
});
