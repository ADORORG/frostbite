import {
  gameClaimStates,
  gameClaimUnavailableReasons,
} from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import {
  claimStateCopy,
  claimUnavailableCopy,
  feeText,
  isSettledClaim,
} from "../src/domain/claim-copy.ts";

describe("what a claim is called", () => {
  it("has words for every state, and says claimed only when the network's records show it", () => {
    for (const state of gameClaimStates) {
      expect(claimStateCopy[state].label.length).toBeGreaterThan(0);
      expect(claimStateCopy[state].detail.length).toBeGreaterThan(0);
    }
    const saidClaimed = gameClaimStates.filter(
      (state) => claimStateCopy[state].label === "Claimed",
    );
    expect(saidClaimed).toEqual(["complete"]);
    expect(claimStateCopy.claimed.label).toBe("Confirmed");
    expect(claimStateCopy.claimed.detail).toContain("not complete until");
  });

  it("never says minted", () => {
    const said = [
      ...gameClaimStates.flatMap((state) =>
        Object.values(claimStateCopy[state]),
      ),
      ...Object.values(claimUnavailableCopy),
    ].join(" ");
    expect(said.toLowerCase()).not.toContain("mint");
  });

  it("has words for every reason a claim cannot start, and for being signed out", () => {
    for (const reason of gameClaimUnavailableReasons)
      expect(claimUnavailableCopy[reason].length).toBeGreaterThan(0);
    expect(claimUnavailableCopy["signed-out"]).toBe("Sign in to claim.");
  });
});

describe("when a claim is over", () => {
  it("is over when it took effect, failed, or lapsed, and not otherwise", () => {
    expect(gameClaimStates.filter(isSettledClaim).sort()).toEqual([
      "complete",
      "expired",
      "failed",
    ]);
  });
});

describe("the fee as the review shows it", () => {
  it("is the amount in the smallest unit and the asset it is paid in", () => {
    expect(
      feeText({
        chain: "simnet:one",
        contractId: "rewards-1",
        expiresAt: "2026-10-16T12:10:00.000Z",
        fee: { asset: "sim", baseUnits: "12" },
        milestoneId: "first-win",
        recipient: "x",
      }),
    ).toBe("12 sim");
  });
});
