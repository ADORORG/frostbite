import { describe, expect, it } from "vitest";

import { trackedStates as lifecycleStates } from "@ador/shared/chain";

import { playerClaimState } from "../src/player-state.ts";

describe("what a claim is called to the player", () => {
  it("names every state the lifecycle has, and only with one of six words", () => {
    const words = new Set(lifecycleStates.map(playerClaimState));
    expect([...words].sort()).toEqual([
      "awaiting-signature",
      "claimed",
      "complete",
      "expired",
      "failed",
      "pending",
    ]);
    expect(lifecycleStates).toHaveLength(14);
  });

  it.each([
    ["awaiting_signature", "awaiting-signature"],
    ["signed", "pending"],
    ["broadcast_unknown", "pending"],
    ["broadcast_accepted", "pending"],
    ["pending", "pending"],
    ["confirmed", "claimed"],
    ["indexed_success", "claimed"],
    ["reconciled", "claimed"],
    ["complete", "complete"],
    ["broadcast_rejected", "failed"],
    ["indexed_failure", "failed"],
    ["expired", "expired"],
  ] as const)("calls %s %s", (state, word) => {
    expect(playerClaimState(state)).toBe(word);
  });

  it("calls a claim complete only in the one state where the chain's indexed state agrees", () => {
    expect(
      lifecycleStates.filter((state) => playerClaimState(state) === "complete"),
    ).toEqual(["complete"]);
  });
});
