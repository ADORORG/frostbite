import { describe, expect, it } from "vitest";

import {
  decideReviewInputSchema,
  liveSubmissionStates,
  missingSubmissionRequirements,
  resolveSubmissionTransition,
  reviewActionLabels,
  reviewActions,
  reviewActionsNeedingFeedback,
  reviewDecisionSchema,
  reviewRoutes,
  reviewSubmissionSchema,
  submissionRoutes,
  submissionSnapshotSchema,
  submissionActionPastLabels,
  submissionActions,
  submissionStateLabels,
  submissionStates,
  type ReviewAction,
  type SubmissionState,
} from "../src/collections/index.ts";
import { routeContributionSchema } from "../src/features/manifest.ts";

const asset = "018f22f2-9c1a-7b21-8c45-000000000001";
const submission = "018f22f2-9c1a-7b21-8c45-000000000002";
const hash = "a".repeat(64);
const chain = "bip122:00000008819873e925422c1ff0f99f7c";
const collection = {
  bannerAssetId: null,
  coverAssetId: asset,
  description: "About",
  name: "First light",
  plannedSupply: 1,
  provenance: "",
  targetChain: chain,
};
const snapshot = {
  assets: [
    {
      contentSha256: hash,
      id: asset,
      purpose: "collection-artwork",
    },
  ],
  collection,
  items: [
    {
      attributes: [],
      description: "",
      id: asset,
      imageAssetId: asset,
      name: "Item",
      position: 1,
    },
  ],
  schemaVersion: 1,
};

// The whole table, written out, so a change to any one transition fails here by name.
const allowed: Readonly<
  Record<SubmissionState, Partial<Record<ReviewAction, SubmissionState>>>
> = {
  approved: { revoke: "revoked", suspend: "suspended" },
  "changes-requested": {},
  rejected: {},
  revoked: {},
  submitted: { "start-review": "under-review" },
  suspended: { reinstate: "approved", revoke: "revoked" },
  "under-review": {
    approve: "approved",
    "request-changes": "changes-requested",
    reject: "rejected",
  },
};

describe("submission state machine", () => {
  it.each(
    submissionStates.flatMap((state) =>
      reviewActions.map((action) => [state, action] as const),
    ),
  )("%s + %s", (state, action) => {
    expect(resolveSubmissionTransition(state, action)).toBe(
      allowed[state][action] ?? null,
    );
  });

  it("ends a submission in changes-requested, rejected, and revoked", () => {
    for (const state of ["changes-requested", "rejected", "revoked"] as const)
      expect(
        reviewActions.every(
          (action) => resolveSubmissionTransition(state, action) === null,
        ),
      ).toBe(true);
  });

  it("keeps a submission live exactly while it can still be approved or suspended", () => {
    expect([...liveSubmissionStates].sort()).toEqual(
      ["approved", "submitted", "suspended", "under-review"].sort(),
    );
    for (const state of submissionStates)
      expect(liveSubmissionStates.some((live) => live === state)).toBe(
        !["changes-requested", "rejected", "revoked"].includes(state),
      );
  });
});

describe("review decision", () => {
  const decision = {
    action: "approve",
    creatorFeedback: "",
    privateNotes: "",
    reasonCode: "meets-policy",
    submissionId: submission,
  };

  it("accepts an approval without feedback", () => {
    expect(reviewDecisionSchema.safeParse(decision).success).toBe(true);
  });

  it.each(["request-changes", "reject", "suspend", "revoke"] as const)(
    "requires words for the creator on %s",
    (action) => {
      const bare = reviewDecisionSchema.safeParse({ ...decision, action });
      expect(bare.success).toBe(false);
      expect(
        reviewDecisionSchema.safeParse({
          ...decision,
          action,
          creatorFeedback: "  The artwork is unclear.  ",
        }).success,
      ).toBe(true);
    },
  );

  it("treats blank feedback as missing, and refuses unknown fields and actions", () => {
    expect(
      decideReviewInputSchema.safeParse({
        ...decision,
        action: "reject",
        creatorFeedback: "   ",
      }).success,
    ).toBe(false);
    expect(
      reviewDecisionSchema.safeParse({ ...decision, extra: 1 }).success,
    ).toBe(false);
    expect(
      reviewDecisionSchema.safeParse({ ...decision, action: "submit" }).success,
    ).toBe(false);
  });
});

describe("submission snapshot", () => {
  it("accepts a complete snapshot and refuses extra or missing parts", () => {
    expect(submissionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      submissionSnapshotSchema.safeParse({ ...snapshot, extra: true }).success,
    ).toBe(false);
    expect(
      submissionSnapshotSchema.safeParse({ ...snapshot, schemaVersion: 2 })
        .success,
    ).toBe(false);
    expect(
      submissionSnapshotSchema.safeParse({
        ...snapshot,
        assets: [{ ...snapshot.assets[0], contentSha256: "XYZ" }],
      }).success,
    ).toBe(false);
  });

  it("is carried whole in the staff view of a submission", () => {
    const view = reviewSubmissionSchema.safeParse({
      collectionId: asset,
      collectionRevision: 3,
      createdAt: "2026-10-10T10:00:00.000Z",
      events: [],
      id: submission,
      ownerState: "approved",
      ownerUserId: asset,
      payloadHash: hash,
      sequence: 1,
      snapshot,
      state: "submitted",
      updatedAt: "2026-10-10T10:00:00.000Z",
    });
    expect(view.success).toBe(true);
  });
});

describe("submission readiness", () => {
  const ready = { collection, itemCount: 1 };

  it("reports nothing missing for a complete collection", () => {
    expect(missingSubmissionRequirements(ready)).toEqual([]);
  });

  it.each([
    [
      "a blank description",
      { ...collection, description: "   " },
      1,
      ["description"],
    ],
    [
      "no cover image",
      { ...collection, coverAssetId: null },
      1,
      ["cover-image"],
    ],
    ["too few items", collection, 0, ["all-items"]],
    ["too many items", collection, 2, ["all-items"]],
    [
      "everything",
      { ...collection, coverAssetId: null, description: "" },
      0,
      ["description", "cover-image", "all-items"],
    ],
  ] as const)("reports %s", (_name, draft, itemCount, expected) => {
    expect(
      missingSubmissionRequirements({ collection: draft, itemCount }),
    ).toEqual(expected);
  });
});

// Reading is a GET, so a browser can keep the answer; only these two change something.
const writes: ReadonlySet<string> = new Set([
  "decideCollectionReview",
  "submitCollection",
]);

describe("review and submission routes", () => {
  it("are operations whose ids and paths are unique and valid manifest routes", () => {
    const routes = [
      ...Object.values(submissionRoutes),
      ...Object.values(reviewRoutes),
    ];
    expect(new Set(routes.map(({ operationId }) => operationId)).size).toBe(
      routes.length,
    );
    expect(new Set(routes.map(({ path }) => path)).size).toBe(routes.length);
    for (const route of routes) {
      expect(route.method).toBe(writes.has(route.operationId) ? "POST" : "GET");
      expect(routeContributionSchema.safeParse(route).success).toBe(true);
    }
  });
});

describe("the words for states and actions", () => {
  it("has a distinct label for every state and every review action", () => {
    expect(
      new Set(submissionStates.map((state) => submissionStateLabels[state]))
        .size,
    ).toBe(submissionStates.length);
    expect(
      new Set(reviewActions.map((action) => reviewActionLabels[action])).size,
    ).toBe(reviewActions.length);
  });

  it("asks for feedback exactly where a decision ends or withholds something from the creator", () => {
    expect([...reviewActionsNeedingFeedback].sort()).toEqual(
      ["request-changes", "reject", "revoke", "suspend"].sort(),
    );
    for (const action of reviewActions)
      expect(
        reviewDecisionSchema.safeParse({
          action,
          creatorFeedback: "",
          privateNotes: "",
          reasonCode: "meets-policy",
          submissionId: submission,
        }).success,
      ).toBe(!reviewActionsNeedingFeedback.includes(action));
  });
});

describe("the past tense of each action", () => {
  it("has a distinct phrase for every action that reads after a name", () => {
    const phrases = submissionActions.map(
      (action) => submissionActionPastLabels[action],
    );
    expect(new Set(phrases).size).toBe(submissionActions.length);
    expect(submissionActionPastLabels.approve).toBe("approved");
    expect(submissionActionPastLabels.submit).toBe("submitted");
  });
});
