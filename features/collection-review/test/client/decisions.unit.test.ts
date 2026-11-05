import {
  resolveSubmissionTransition,
  reviewActions,
  reviewDecisionSchema,
  submissionStates,
} from "@frostbite/shared/collections";
import { describe, expect, it } from "vitest";

import {
  availableActions,
  confirmedActions,
  emptyDecisionForm,
  needsFeedback,
  parseDecision,
  reasonCodes,
} from "../../src/client/decisions.ts";
import { id } from "../support/fixtures.ts";

const submissionId = id();

describe("what a reviewer can do from each state", () => {
  it.each(submissionStates)(
    "offers from %s exactly what the state machine allows",
    (state) => {
      expect(availableActions(state)).toEqual(
        reviewActions.filter(
          (action) => resolveSubmissionTransition(state, action) !== null,
        ),
      );
    },
  );

  it("starts a review from submitted, decides from in review, and offers nothing once finished", () => {
    expect(availableActions("submitted")).toEqual(["start-review"]);
    expect(availableActions("under-review")).toEqual([
      "approve",
      "request-changes",
      "reject",
    ]);
    expect(availableActions("approved")).toEqual(["suspend", "revoke"]);
    expect(availableActions("suspended")).toEqual(["reinstate", "revoke"]);
    for (const state of ["changes-requested", "rejected", "revoked"] as const)
      expect(availableActions(state)).toEqual([]);
  });

  it("gives every action an audit reason that the server accepts", () => {
    for (const action of reviewActions)
      expect(
        reviewDecisionSchema.safeParse({
          action,
          creatorFeedback: "Words.",
          privateNotes: "",
          reasonCode: reasonCodes[action],
          submissionId,
        }).success,
      ).toBe(true);
  });

  it("asks for confirmation only where a decision cannot be undone", () => {
    expect([...confirmedActions].sort()).toEqual(["reject", "revoke"]);
    expect(needsFeedback("reject")).toBe(true);
    expect(needsFeedback("approve")).toBe(false);
  });
});

describe("parsing a decision form", () => {
  it("asks the reviewer to choose first", () => {
    expect(parseDecision(submissionId, emptyDecisionForm)).toEqual({
      errors: { action: "Choose what to do." },
      ok: false,
    });
  });

  it("builds the decision the server expects, trimmed, with the action's reason", () => {
    expect(
      parseDecision(submissionId, {
        action: "request-changes",
        creatorFeedback: "  Add a banner.  ",
        privateNotes: " check rights ",
      }),
    ).toEqual({
      decision: {
        action: "request-changes",
        creatorFeedback: "Add a banner.",
        privateNotes: "check rights",
        reasonCode: "reviewer-requested-changes",
        submissionId,
      },
      ok: true,
    });
  });

  it("accepts an approval without feedback", () => {
    expect(
      parseDecision(submissionId, { ...emptyDecisionForm, action: "approve" })
        .ok,
    ).toBe(true);
  });

  it.each(["request-changes", "reject", "suspend", "revoke"] as const)(
    "refuses %s without words for the creator",
    (action) => {
      const result = parseDecision(submissionId, {
        ...emptyDecisionForm,
        action,
      });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.errors.creatorFeedback).toContain(
        "Write what the creator should know",
      );
    },
  );

  it("refuses text over the limits, naming the field", () => {
    const tooLong = "x".repeat(5_000);
    const feedback = parseDecision(submissionId, {
      action: "approve",
      creatorFeedback: tooLong,
      privateNotes: "",
    });
    const notes = parseDecision(submissionId, {
      action: "approve",
      creatorFeedback: "",
      privateNotes: tooLong,
    });
    expect(feedback.ok === false && feedback.errors).toEqual({
      creatorFeedback: "Keep this to 2,000 characters.",
    });
    expect(notes.ok === false && notes.errors).toEqual({
      privateNotes: "Keep notes to 4,000 characters.",
    });
  });
});
