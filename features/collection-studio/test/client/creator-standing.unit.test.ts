import type {
  CollectionSummary,
  SubmissionState,
} from "@ador/shared/collections";
import { creatorApplicationStates } from "@ador/shared/creator-admission";
import { describe, expect, it } from "vitest";

import {
  applicationHref,
  describeCreatorStanding,
  nextStep,
} from "../../src/client/creator-standing.ts";
import { id, signet } from "../support/stubs.ts";

const summary = (
  name: string,
  submissionState: SubmissionState | null,
): CollectionSummary => ({
  coverAssetId: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  id: id(),
  itemCount: 1,
  name,
  plannedSupply: 2,
  revision: 1,
  submissionState,
  targetChain: signet,
  updatedAt: "2026-10-09T13:00:00.000Z",
});

describe("creator standing", () => {
  it("lets only an approved creator build collections", () => {
    const allowed = [...creatorApplicationStates, null].filter(
      (state) => describeCreatorStanding(state).canCreate,
    );
    expect(allowed).toEqual(["approved"]);
  });

  it("says something and points somewhere useful in every state", () => {
    for (const state of [...creatorApplicationStates, null]) {
      const copy = describeCreatorStanding(state);
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      // Everyone but an approved creator is sent to their application, the one place it can move on.
      if (state === "approved") expect(copy.action).toBeNull();
      else expect(copy.action?.href).toBe(applicationHref);
    }
  });

  it("invites a person who never applied to apply, and one with a draft to finish it", () => {
    expect(describeCreatorStanding(null).action?.label).toBe("Apply to create");
    expect(describeCreatorStanding("draft").action?.label).toBe(
      "Finish your application",
    );
    expect(describeCreatorStanding("changes-requested").action?.label).toBe(
      "Update your application",
    );
  });

  it("does not promise anything to a creator whose access was paused, ended, or refused", () => {
    for (const state of ["suspended", "revoked", "rejected"] as const)
      expect(describeCreatorStanding(state)).toMatchObject({
        canCreate: false,
        tone: "red",
      });
  });
});

describe("what to do next", () => {
  it("before approval, is the application", () => {
    expect(nextStep(null, [])).toMatchObject({
      href: applicationHref,
      label: "Apply to create",
      text: describeCreatorStanding(null).body,
    });
    expect(nextStep("under-review", null)).toMatchObject({
      href: applicationHref,
    });
  });

  it("suggests nothing to an approved creator until the list of collections has loaded", () => {
    expect(nextStep("approved", null)).toBeNull();
  });

  it("starts the first collection for an approved creator with none", () => {
    expect(nextStep("approved", [])).toMatchObject({
      href: "/studio/collections/new",
      label: "Start your first collection",
    });
  });

  it("puts changes a reviewer asked for ahead of a draft", () => {
    const step = nextStep("approved", [
      summary("Draft one", null),
      summary("Asked", "changes-requested"),
    ]);
    expect(step?.label).toBe("Make changes");
    expect(step?.text).toContain("Asked");
    expect(step?.href).toMatch(/^\/studio\/collections\/.+/u);
  });

  it("continues a draft when nothing needs changes", () => {
    const step = nextStep("approved", [
      summary("In review", "submitted"),
      summary("My draft", null),
    ]);
    expect(step?.label).toBe("Continue editing");
    expect(step?.text).toContain("My draft");
  });

  it("offers another collection when nothing is waiting on the creator", () => {
    expect(
      nextStep("approved", [
        summary("A", "submitted"),
        summary("B", "approved"),
      ]),
    ).toMatchObject({
      href: "/studio/collections/new",
      label: "Start a collection",
      text: "Nothing is waiting on you.",
    });
  });
});
