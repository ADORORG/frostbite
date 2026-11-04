import {
  chainUnreachableWords,
  signatureMismatchWords,
} from "@ador/shared/chain-step-words";
import {
  gameClaimRefusalReasons,
  gameClaimStates,
  gameClaimUnavailableReasons,
} from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import {
  claimCopy,
  claimStateCopy,
  claimSubmitRefusalCopy,
  claimUnavailableCopy,
  isSettledClaim,
  showsDelayed,
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

describe("a claim that is taking long", () => {
  it("says so for the two states that wait on the network, and says it has not failed", () => {
    expect(claimCopy({ delayed: true, state: "pending" })).toMatchObject({
      label: "Sent, delayed",
    });
    expect(claimCopy({ delayed: true, state: "claimed" })).toMatchObject({
      label: "Confirmed, delayed",
    });
    for (const state of ["pending", "claimed"] as const) {
      const said = claimCopy({ delayed: true, state }).detail;
      expect(said).toContain("not failed");
      expect(said).not.toContain("Failed");
    }
  });

  it("keeps the ordinary words unless it is delayed, and never calls a claim that is not waiting delayed", () => {
    for (const state of gameClaimStates) {
      expect(claimCopy({ delayed: false, state })).toBe(claimStateCopy[state]);
      expect(showsDelayed({ delayed: true, state })).toBe(
        state === "pending" || state === "claimed",
      );
      if (state !== "pending" && state !== "claimed")
        expect(claimCopy({ delayed: true, state })).toBe(claimStateCopy[state]);
    }
  });

  it("never says minted", () => {
    expect(
      Object.values(claimCopy({ delayed: true, state: "pending" })).join(" "),
    ).not.toMatch(/mint/iu);
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

describe("why the platform turned down what the wallet signed", () => {
  it("has words, about a claim, for every reason a signed claim is turned down", () => {
    expect(Object.keys(claimSubmitRefusalCopy).sort()).toEqual(
      [...gameClaimRefusalReasons].sort(),
    );
    for (const reason of gameClaimRefusalReasons)
      expect(claimSubmitRefusalCopy[reason].length).toBeGreaterThan(20);
    expect(claimSubmitRefusalCopy.expired).toContain("claim");
  });

  it("says the network is gone, and the signature is not what was shown, in the platform's one wording", () => {
    expect(claimSubmitRefusalCopy["chain-unavailable"]).toBe(
      chainUnreachableWords,
    );
    expect(claimSubmitRefusalCopy["invalid-signature"]).toBe(
      signatureMismatchWords,
    );
    expect(claimUnavailableCopy.unavailable).toBe(chainUnreachableWords);
  });
});
