import { describe, expect, it } from "vitest";

import {
  creatorApplicationDraftSchema,
  creatorApplicationViewSchema,
  creatorApplicationPath,
  creatorApplicationStates,
  creatorApplicationSubmissionSchema,
  creatorReviewPath,
  creatorStandingCopy,
  neverAppliedCopy,
  resolveCreatorAdmissionTransition,
  standingBadgeLabel,
} from "../src/creator-admission/index.ts";

const completeDraft = {
  contentDeclarationAccepted: true,
  displayName: "Arcade Builder",
  expectedLaunchSize: "A small beta cohort",
  expectedLaunchTiming: "After review",
  jurisdictionAcknowledged: true,
  portfolioLinks: ["https://example.test/work"],
  projectSummary: "A Bitcoin-native arcade experience.",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};

describe("creator admission contracts", () => {
  it("accepts a complete submission and rejects unaccepted declarations", () => {
    expect(
      creatorApplicationSubmissionSchema.safeParse(completeDraft).success,
    ).toBe(true);
    expect(
      creatorApplicationSubmissionSchema.safeParse({
        ...completeDraft,
        rightsDeclarationAccepted: false,
      }).success,
    ).toBe(false);
  });

  it("rejects oversized, malformed, and additional draft data", () => {
    expect(
      creatorApplicationDraftSchema.safeParse({
        ...completeDraft,
        displayName: "x".repeat(121),
      }).success,
    ).toBe(false);
    expect(
      creatorApplicationDraftSchema.safeParse({
        ...completeDraft,
        portfolioLinks: ["not-a-url"],
      }).success,
    ).toBe(false);
    expect(
      creatorApplicationDraftSchema.safeParse({
        ...completeDraft,
        trusted: true,
      }).success,
    ).toBe(false);
  });

  it("allows only explicit lifecycle transitions", () => {
    expect(resolveCreatorAdmissionTransition("draft", "submit")).toBe(
      "submitted",
    );
    expect(
      resolveCreatorAdmissionTransition("submitted", "approve"),
    ).toBeNull();
    expect(resolveCreatorAdmissionTransition("under-review", "approve")).toBe(
      "approved",
    );
    expect(resolveCreatorAdmissionTransition("suspended", "reinstate")).toBe(
      "approved",
    );
    expect(resolveCreatorAdmissionTransition("revoked", "resubmit")).toBeNull();
    expect(
      resolveCreatorAdmissionTransition("rejected", "resubmit"),
    ).toBeNull();
  });
});

describe("creator standing copy", () => {
  it("words every state and the never-applied case, and lets only an approved creator build", () => {
    const all = [
      ...creatorApplicationStates.map((state) => creatorStandingCopy[state]),
      neverAppliedCopy,
    ];
    for (const copy of all) {
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
    expect(
      creatorApplicationStates.filter(
        (state) => creatorStandingCopy[state].canCreate,
      ),
    ).toEqual(["approved"]);
    expect(neverAppliedCopy.canCreate).toBe(false);
  });

  it("colours a state by how good or bad it is for the creator", () => {
    expect(creatorStandingCopy.approved.tone).toBe("mint");
    for (const state of ["rejected", "revoked", "suspended"] as const)
      expect(creatorStandingCopy[state].tone).toBe("red");
    for (const state of ["submitted", "under-review"] as const)
      expect(creatorStandingCopy[state].tone).toBe("cyan");
    expect(creatorStandingCopy["changes-requested"].tone).toBe("pink");
    expect(creatorStandingCopy.draft.tone).toBe("yellow");
    expect(neverAppliedCopy.tone).toBe("yellow");
  });
});

describe("creator admission pages", () => {
  it("are static paths under the studio and the admin area", () => {
    expect(creatorApplicationPath).toBe("/studio/creator-application");
    expect(creatorReviewPath).toBe("/admin/creator-applications");
    for (const path of [creatorApplicationPath, creatorReviewPath])
      expect(path).not.toContain("[");
  });
});

describe("standing badge", () => {
  it("answers whether collections can be built, for every standing and for a person who never applied", () => {
    expect(standingBadgeLabel(creatorStandingCopy.approved)).toBe(
      "Can build collections",
    );
    for (const state of creatorApplicationStates.filter(
      (s) => s !== "approved",
    ))
      expect(standingBadgeLabel(creatorStandingCopy[state])).toBe(
        "Cannot build collections yet",
      );
    expect(standingBadgeLabel(neverAppliedCopy)).toBe(
      "Cannot build collections yet",
    );
  });
});

describe("the applicant's view of an application", () => {
  const view = {
    applicantUserId: "01994b10-0000-7000-8000-000000000001",
    draft: completeDraft,
    feedback: null,
    id: "01994b10-0000-7000-8000-000000000002",
    revision: 1,
    state: "changes-requested",
  };

  it("carries the reviewer's latest message for the applicant, or null, and nothing else about the decision", () => {
    expect(creatorApplicationViewSchema.parse(view).feedback).toBeNull();
    const message = {
      createdAt: "2026-10-10T12:30:00.000Z",
      text: "Add a portfolio link.",
    };
    expect(
      creatorApplicationViewSchema.parse({ ...view, feedback: message })
        .feedback,
    ).toEqual(message);
    // The private notes are not a field of the view, so they cannot be carried by it.
    expect(() =>
      creatorApplicationViewSchema.parse({
        ...view,
        feedback: { ...message, privateNotes: "Looks copied." },
      }),
    ).toThrow();
  });

  it("refuses a view with no feedback field, an empty message, or a time that is not a time", () => {
    expect(() =>
      creatorApplicationViewSchema.parse({ ...view, feedback: undefined }),
    ).toThrow();
    expect(() =>
      creatorApplicationViewSchema.parse({
        ...view,
        feedback: { createdAt: "2026-10-10T12:30:00.000Z", text: "" },
      }),
    ).toThrow();
    expect(() =>
      creatorApplicationViewSchema.parse({
        ...view,
        feedback: { createdAt: "yesterday", text: "Add a link." },
      }),
    ).toThrow();
  });
});
