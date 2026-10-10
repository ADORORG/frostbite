import { describe, expect, it } from "vitest";

import {
  collectionStandingLabels,
  collectionStandings,
  standingOf,
  submissionStates,
} from "../src/collections/index.ts";

describe("collection standing", () => {
  it("is a draft until the collection has been submitted", () => {
    expect(standingOf(null)).toBe("draft");
  });

  it.each([
    ["submitted", "in-review"],
    ["under-review", "in-review"],
    ["changes-requested", "needs-changes"],
    ["approved", "approved"],
    ["rejected", "closed"],
    ["suspended", "closed"],
    ["revoked", "closed"],
  ] as const)("puts a %s submission in %s", (state, standing) => {
    expect(standingOf(state)).toBe(standing);
  });

  it("gives every submission state a standing, and every standing a label", () => {
    for (const state of submissionStates)
      expect(collectionStandings).toContain(standingOf(state));
    expect(Object.keys(collectionStandingLabels).sort()).toEqual(
      [...collectionStandings].sort(),
    );
  });
});
