import { describe, expect, it } from "vitest";

import { nextLibraryRefreshDelay } from "../../src/client/library-refresh.ts";
import { libraryAsset, processedAsset } from "../support/library-fixtures.ts";

const policy = {
  minimumRefreshDelayMs: 5_000,
  pollIntervalMs: 8_000,
  signedUrlRefreshMarginMs: 30_000,
};
const issued = Date.parse("2026-10-06T12:00:00.000Z");

describe("library refresh scheduling", () => {
  it("needs no refresh for an empty library or one with only rejected assets", () => {
    expect(nextLibraryRefreshDelay([], issued, policy)).toBeNull();
    expect(
      nextLibraryRefreshDelay(
        [libraryAsset({ processingState: "rejected" })],
        issued,
        policy,
      ),
    ).toBeNull();
  });

  it("polls while any asset is still being processed", () => {
    expect(nextLibraryRefreshDelay([libraryAsset()], issued, policy)).toBe(
      8_000,
    );
    expect(
      nextLibraryRefreshDelay(
        [libraryAsset({ processingState: "validated" })],
        issued,
        policy,
      ),
    ).toBe(8_000);
  });

  it("refreshes before the earliest signed URL expires, minus the margin", () => {
    // Expires at +5 min; with a 30 s margin the refresh is due at +270 s.
    expect(nextLibraryRefreshDelay([processedAsset()], issued, policy)).toBe(
      270_000,
    );
    const early = processedAsset({
      derivatives: processedAsset().derivatives.map((derivative, index) =>
        index === 0
          ? { ...derivative, expiresAt: "2026-10-06T12:01:00.000Z" }
          : derivative,
      ),
    });
    expect(
      nextLibraryRefreshDelay([processedAsset(), early], issued, policy),
    ).toBe(30_000);
  });

  it("takes the sooner of polling and expiry", () => {
    expect(
      nextLibraryRefreshDelay(
        [libraryAsset(), processedAsset()],
        issued,
        policy,
      ),
    ).toBe(8_000);
  });

  it("never schedules faster than the floor, even for URLs already expired", () => {
    expect(
      nextLibraryRefreshDelay([processedAsset()], issued + 10 * 60_000, policy),
    ).toBe(5_000);
    expect(
      nextLibraryRefreshDelay([libraryAsset()], issued, {
        ...policy,
        pollIntervalMs: 1,
      }),
    ).toBe(5_000);
  });
});
