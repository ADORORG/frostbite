import { createUuidV7 } from "@frostbite/shared/identifiers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const findMine = vi.fn();

vi.mock("../src/runtime.ts", () => ({
  getCreatorAdmissionService: () => ({
    findMine,
    readForReview: vi.fn(),
    review: vi.fn(),
    reviewQueue: vi.fn(),
    saveDraft: vi.fn(),
    submit: vi.fn(),
  }),
}));

import { createCreatorAdmissionEntrypoint } from "../src/entrypoint.tsx";

describe("creator admission entrypoint", () => {
  it("contributes matching operations and pages", () => {
    const entrypoint = createCreatorAdmissionEntrypoint();
    expect(entrypoint.operations).toHaveLength(6);
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual([
      "/studio/creator-application",
      "/admin/creator-applications",
      "/admin/creator-applications/[applicationId]",
    ]);
  });

  it("renders saved, anonymous, reviewer, and degraded page states", async () => {
    const actorUserId = createUuidV7();
    findMine
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("offline"));
    const pages = createCreatorAdmissionEntrypoint().pages ?? [];
    const studio = pages[0];
    const review = pages[1];
    if (studio === undefined || review === undefined)
      throw new Error("Expected pages");
    expect(
      renderToStaticMarkup(
        await studio.render({ actorUserId, navigation: [], params: {} }),
      ),
    ).toContain("Apply to create");
    expect(
      renderToStaticMarkup(
        await studio.render({ actorUserId: null, navigation: [], params: {} }),
      ),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        await studio.render({ actorUserId, navigation: [], params: {} }),
      ),
    ).toContain("No state is being inferred");
    expect(
      renderToStaticMarkup(
        await review.render({ actorUserId, navigation: [], params: {} }),
      ),
    ).toContain("Creator reviews");
  });

  it("renders a saved application with the message a reviewer wrote, dates and all", async () => {
    const actorUserId = createUuidV7();
    findMine.mockResolvedValueOnce({
      applicantUserId: actorUserId,
      draft: {
        contentDeclarationAccepted: true,
        displayName: "Saved Creator",
        expectedLaunchSize: "Small",
        expectedLaunchTiming: "Soon",
        jurisdictionAcknowledged: true,
        portfolioLinks: [],
        projectSummary: "Summary",
        provenanceDeclarationAccepted: true,
        rightsDeclarationAccepted: true,
      },
      feedback: {
        createdAt: new Date("2026-10-10T12:30:00.000Z"),
        text: "Add a portfolio link.",
      },
      id: createUuidV7(),
      revision: 2,
      state: "changes-requested",
    });
    const studio = createCreatorAdmissionEntrypoint().pages?.[0];
    if (studio === undefined) throw new Error("Expected page");
    const markup = renderToStaticMarkup(
      await studio.render({ actorUserId, navigation: [], params: {} }),
    );
    expect(markup).toContain("Changes requested");
    expect(markup).toContain("From a reviewer, 2026-10-10");
    expect(markup).toContain("Add a portfolio link.");
    expect(markup).toContain("Saved Creator");
  });
});
