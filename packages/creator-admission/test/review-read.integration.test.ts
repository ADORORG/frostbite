import { describe, expect, it } from "vitest";

import {
  at,
  decision,
  request,
  sentApplication,
  service,
  useCreatorDatabase,
  user,
} from "./support/world.ts";

useCreatorDatabase();

describe("reading an application for review", () => {
  it("reads the frozen version and the whole history, private notes included, for staff", async () => {
    const reviewer = await user("reviewer");
    const sent = await sentApplication(
      "Frozen",
      "2026-10-01T10:00:00.000Z",
      "d",
    );
    at("2026-10-02T10:00:00.000Z");
    await service.review(
      decision(sent.id, "start-review", { privateNotes: "Looks fine." }),
      request(reviewer, "d-1"),
    );
    // The applicant keeps editing after the submission; the frozen version does not move.
    const detail = await service.readForReview(sent.id);
    expect(detail).toMatchObject({
      applicationId: sent.id,
      snapshot: { displayName: "Frozen" },
      state: "under-review",
      submissionNumber: 1,
    });
    expect(detail?.events.map(({ action }) => action)).toEqual([
      "save-draft",
      "submit",
      "start-review",
    ]);
    expect(detail?.events.at(-1)).toMatchObject({
      actorName: "reviewer",
      privateNotes: "Looks fine.",
    });
  });

  it("does not read what was never sent, or what does not exist", async () => {
    const applicant = await user();
    at("2026-10-01T10:00:00.000Z");
    await service.saveDraft(
      {
        contentDeclarationAccepted: false,
        displayName: "Private draft",
        expectedLaunchSize: "x",
        expectedLaunchTiming: "y",
        jurisdictionAcknowledged: false,
        portfolioLinks: [],
        projectSummary: "z",
        provenanceDeclarationAccepted: false,
        rightsDeclarationAccepted: false,
      },
      request(applicant, "never-sent"),
    );
    const mine = await service.findMine(applicant);
    if (mine === null) throw new Error("Expected application");
    await expect(service.readForReview(mine.id)).resolves.toBeNull();
    await expect(
      service.readForReview(
        "01994b10-0000-7000-8000-0000000000ff" as typeof mine.id,
      ),
    ).resolves.toBeNull();
  });
});
