import {
  submissionStates,
  type CollectionSubmission,
  type SubmissionState,
} from "@frostbite/shared/collections";
import { describe, expect, it } from "vitest";

import { submissionStateCopy } from "../../src/client/submission-copy.ts";
import {
  draftChangedSince,
  latestSubmission,
  submitAvailability,
} from "../../src/client/submission-progress.ts";
import { detail, imageAsset, itemRecord } from "../support/detail.ts";
import { id } from "../support/stubs.ts";

const stamp = "2026-10-10T12:00:00.000Z";
const submission = (
  state: SubmissionState,
  overrides: Partial<CollectionSubmission> = {},
): CollectionSubmission => ({
  collectionId: id(),
  collectionRevision: 2,
  createdAt: stamp,
  decisions: [],
  id: id(),
  payloadHash: "a".repeat(64),
  sequence: 1,
  state,
  updatedAt: stamp,
  ...overrides,
});

const cover = imageAsset("collection-artwork");
const ready = () =>
  detail({ coverAssetId: cover.id, description: "About", plannedSupply: 1 }, [
    itemRecord(1),
  ]);

describe("when a collection can be submitted", () => {
  it("is ready with nothing submitted yet, and not an 'again'", () => {
    expect(submitAvailability(ready(), null)).toEqual({
      again: false,
      kind: "ready",
    });
  });

  it("names what is missing, in the order the checklist shows it", () => {
    expect(submitAvailability(detail(), null)).toEqual({
      kind: "missing",
      missing: ["description", "cover-image", "all-items"],
    });
  });

  it("is ready again after changes were requested, but still missing what the creator removed", () => {
    expect(
      submitAvailability(ready(), submission("changes-requested")),
    ).toEqual({
      again: true,
      kind: "ready",
    });
    expect(
      submitAvailability(
        detail({ ...ready().collection, description: "" }, ready().items),
        submission("changes-requested"),
      ),
    ).toEqual({ kind: "missing", missing: ["description"] });
  });

  it.each(["submitted", "under-review", "approved", "suspended"] as const)(
    "is live while a submission is %s, however complete the draft is",
    (state) => {
      expect(submitAvailability(ready(), submission(state))).toEqual({
        kind: "live",
      });
    },
  );

  it.each(["rejected", "revoked"] as const)(
    "is closed once a submission was %s",
    (state) => {
      expect(submitAvailability(ready(), submission(state))).toEqual({
        kind: "closed",
      });
    },
  );
});

describe("the newest submission and the draft since", () => {
  it("is the first in the list, which the API returns newest first, or none", () => {
    const [first, second] = [
      submission("approved", { sequence: 2 }),
      submission("rejected"),
    ];
    expect(latestSubmission([first, second])).toBe(first);
    expect(latestSubmission([])).toBeNull();
  });

  it("notices a draft that has moved past the submitted revision, and only then", () => {
    const frozen = submission("submitted", { collectionRevision: 2 });
    expect(draftChangedSince(detail({ revision: 2 }), frozen)).toBe(false);
    expect(draftChangedSince(detail({ revision: 3 }), frozen)).toBe(true);
  });
});

describe("what each state tells the creator", () => {
  it("has plain words and a tone for every state", () => {
    for (const state of submissionStates) {
      const copy = submissionStateCopy[state];
      expect(copy.label).not.toBe("");
      expect(copy.summary).not.toBe("");
    }
  });

  it("says plainly that approval publishes nothing, and that rejection and revocation are final", () => {
    expect(submissionStateCopy.approved.summary).toContain("does not publish");
    expect(submissionStateCopy.rejected.summary).toContain(
      "cannot be submitted again",
    );
    expect(submissionStateCopy.revoked.summary).toContain(
      "cannot be submitted again",
    );
    expect(submissionStateCopy["changes-requested"].summary).toContain(
      "submit again",
    );
  });
});
