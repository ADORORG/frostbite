import { creatorAdmissionEvents } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import {
  database,
  decision,
  draft,
  request,
  service,
  useCreatorDatabase,
  user,
} from "./support/world.ts";

useCreatorDatabase();

// An applicant submitted and a reviewer is about to decide.
async function submitted() {
  const applicant = await user();
  const reviewer = await user("reviewer");
  await service.saveDraft(draft, request(applicant, "draft-feedback-01"));
  await service.submit(request(applicant, "submit-feedback-01"));
  const application = await service.findMine(applicant);
  if (application === null) throw new Error("Expected application");
  let counter = 0;
  const review = (
    action: Parameters<typeof decision>[1],
    words?: Parameters<typeof decision>[2],
  ) =>
    service.review(
      decision(application.id, action, words),
      request(
        reviewer,
        `review-feedback-${String(++counter).padStart(2, "0")}`,
      ),
    );
  return { applicant, application, review };
}

describe("what a reviewer tells the applicant", () => {
  it("is nothing until a reviewer has written something, whatever the applicant did", async () => {
    const { applicant, application, review } = await submitted();
    expect(application.feedback).toBeNull();
    await review("start-review");
    expect((await service.findMine(applicant))?.feedback).toBeNull();
  });

  it("is the message written for the creator, with its time, and never the private notes", async () => {
    const { applicant, review } = await submitted();
    await review("start-review");
    await review("request-changes", {
      creatorFeedback: "Add a portfolio link.",
      privateNotes: "Looks like a copy of another project.",
    });
    const mine = await service.findMine(applicant);
    expect(mine?.state).toBe("changes-requested");
    expect(mine?.feedback).toEqual({
      createdAt: expect.any(Date),
      text: "Add a portfolio link.",
    });
    expect(JSON.stringify(mine)).not.toContain("copy of another project");
  });

  it("is the newest message, and an empty decision does not erase an earlier one", async () => {
    const { applicant, review } = await submitted();
    await review("start-review", { creatorFeedback: "Looking now." });
    await review("request-changes", {
      creatorFeedback: "Add a portfolio link.",
    });
    await service.saveDraft(draft, request(applicant, "draft-feedback-02"));
    await service.submit(request(applicant, "submit-feedback-02"));
    await review("start-review");
    expect((await service.findMine(applicant))?.feedback?.text).toBe(
      "Add a portfolio link.",
    );
    await review("reject", { creatorFeedback: "Not a fit for the beta." });
    expect((await service.findMine(applicant))?.feedback?.text).toBe(
      "Not a fit for the beta.",
    );
  });

  it("comes back with the reviewer's own decision, and with a repeated request", async () => {
    const { applicant, application } = await submitted();
    const reviewer = await user("reviewer");
    const first = request(reviewer, "review-feedback-replay");
    const words = decision(application.id, "start-review", {
      creatorFeedback: "Looking now.",
    });
    await expect(service.review(words, first)).resolves.toMatchObject({
      application: { feedback: { text: "Looking now." } },
      kind: "changed",
    });
    await expect(service.review(words, first)).resolves.toMatchObject({
      application: { feedback: { text: "Looking now." } },
      kind: "replayed",
    });
    expect((await service.findMine(applicant))?.feedback?.text).toBe(
      "Looking now.",
    );
  });

  it("belongs to one applicant and is never shown to another", async () => {
    const { review } = await submitted();
    await review("start-review", { creatorFeedback: "Private to this one." });
    const other = await user();
    await service.saveDraft(draft, request(other, "draft-feedback-other"));
    expect((await service.findMine(other))?.feedback).toBeNull();
  });

  it("ignores text on the applicant's own events, and breaks a tie on the time by the newer event", async () => {
    const { applicant, application } = await submitted();
    const reviewer = await user("reviewer");
    const same = new Date("2026-10-10T12:30:00.000Z");
    const base = {
      applicationId: application.id,
      correlationId: createUuidV7(),
      createdAt: same,
      nextState: "changes-requested" as const,
      policyVersion: "creator-admission-beta-v1",
      previousState: "under-review" as const,
      reasonCode: "feedback-test",
      requestFingerprint: "0".repeat(64),
    };
    // Text on an applicant's event is not a reviewer's message, even if some future code put it there.
    await database.insert(creatorAdmissionEvents).values({
      ...base,
      action: "save-draft",
      actorUserId: applicant,
      creatorFeedback: "Applicant's own words",
      id: createUuidV7(),
      idempotencyKey: "tie-applicant-0001",
    });
    expect((await service.findMine(applicant))?.feedback).toBeNull();
    // Two reviewer decisions at the same instant, the older inserted first: the one with the later id wins.
    // Two ids made in the same millisecond are not ordered by when they were made, so order them here.
    const [older, newer] = [createUuidV7(), createUuidV7()].sort();
    if (older === undefined || newer === undefined)
      throw new Error("two ids expected");
    for (const [id, text] of [
      [older, "Older decision"],
      [newer, "Newer decision"],
    ] as const)
      await database.insert(creatorAdmissionEvents).values({
        ...base,
        action: "request-changes",
        actorUserId: reviewer,
        creatorFeedback: text,
        id,
        idempotencyKey: `tie-${id}`,
      });
    expect((await service.findMine(applicant))?.feedback?.text).toBe(
      "Newer decision",
    );
  });
});
