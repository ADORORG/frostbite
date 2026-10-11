import {
  creatorReviewQueueResponseSchema,
  creatorReviewReadResponseSchema,
  encodeCreatorReviewCursor,
} from "@ador/shared/creator-admission";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createCreatorReviewOperations } from "../src/application/review-operations.ts";
import { emptyCounts } from "./support/review-fixtures.ts";

const context = {
  actorSession: null,
  actorUserId: createUuidV7(),
  correlationId: createUuidV7(),
  idempotencyKey: "operation-request-0001",
};
const anonymous = { ...context, actorUserId: null };
const row = {
  applicationId: createUuidV7(),
  displayName: "Ada Maker",
  state: "submitted" as const,
  submissionNumber: 2,
  submittedAt: new Date("2026-10-10T12:30:00.000Z"),
  updatedAt: new Date("2026-10-11T08:00:00.000Z"),
};
const record = {
  applicationId: row.applicationId,
  events: [
    {
      action: "submit" as const,
      actorName: "Ada Maker",
      createdAt: new Date("2026-10-10T12:30:00.000Z"),
      creatorFeedback: "",
      nextState: "submitted" as const,
      previousState: "draft" as const,
      privateNotes: "",
      reasonCode: "applicant-submitted",
    },
  ],
  snapshot: {
    contentDeclarationAccepted: true as const,
    displayName: "Ada Maker",
    expectedLaunchSize: "Small",
    expectedLaunchTiming: "After review",
    jurisdictionAcknowledged: true as const,
    portfolioLinks: [],
    projectSummary: "Pixel games.",
    provenanceDeclarationAccepted: true as const,
    rightsDeclarationAccepted: true as const,
  },
  state: "submitted" as const,
  submissionNumber: 2,
  submittedAt: row.submittedAt,
};

function setup() {
  const service = {
    findMine: vi.fn(),
    readForReview: vi.fn().mockResolvedValue(record),
    review: vi.fn(),
    reviewQueue: vi.fn().mockResolvedValue({
      counts: emptyCounts,
      items: [row],
      nextPosition: null,
    }),
    saveDraft: vi.fn(),
    submit: vi.fn(),
  };
  const [queue, read] = createCreatorReviewOperations(() => service);
  return { queue, read, service };
}

describe("creator review queue operation", () => {
  it("is for reviewers only and refuses a missing actor", async () => {
    const { queue, service } = setup();
    expect(queue.access).toEqual({
      capability: "creator:review",
      kind: "platform",
    });
    await expect(
      queue.execute({ cursor: null, group: "all", sort: "oldest" }, anonymous),
    ).resolves.toMatchObject({ error: "unauthorized", ok: false });
    expect(service.reviewQueue).not.toHaveBeenCalled();
  });

  it("returns a first page in its wire form, valid against the shared schema", async () => {
    const { queue, service } = setup();
    const result = await queue.execute(
      { cursor: null, group: "needs-review", sort: "newest" },
      context,
    );
    expect(service.reviewQueue).toHaveBeenCalledWith({
      group: "needs-review",
      position: null,
      sort: "newest",
    });
    if (!result.ok) throw new Error("Expected a page");
    expect(result.value.items[0]?.submittedAt).toBe("2026-10-10T12:30:00.000Z");
    expect(result.value.nextCursor).toBeNull();
    expect(
      creatorReviewQueueResponseSchema.safeParse(result.value).success,
    ).toBe(true);
  });

  it("turns the next position into a cursor, and a cursor back into the position", async () => {
    const { queue, service } = setup();
    const position = { id: createUuidV7(), key: "2026-10-10T12:30:00.000Z" };
    service.reviewQueue.mockResolvedValueOnce({
      counts: emptyCounts,
      items: [row],
      nextPosition: position,
    });
    const first = await queue.execute(
      { cursor: null, group: "all", sort: "oldest" },
      context,
    );
    if (!first.ok || first.value.nextCursor === null)
      throw new Error("Expected a cursor");
    expect(first.value.nextCursor).toBe(encodeCreatorReviewCursor(position));
    await queue.execute(
      { cursor: first.value.nextCursor, group: "all", sort: "oldest" },
      context,
    );
    expect(service.reviewQueue).toHaveBeenLastCalledWith({
      group: "all",
      position,
      sort: "oldest",
    });
  });

  it("pages a name sort whose position is not plain ASCII", async () => {
    const { queue, service } = setup();
    const position = { id: createUuidV7(), key: "zoë 日本 😀" };
    service.reviewQueue.mockResolvedValueOnce({
      counts: emptyCounts,
      items: [row],
      nextPosition: position,
    });
    const first = await queue.execute(
      { cursor: null, group: "all", sort: "name" },
      context,
    );
    if (!first.ok || first.value.nextCursor === null)
      throw new Error("Expected a cursor");
    await queue.execute(
      { cursor: first.value.nextCursor, group: "all", sort: "name" },
      context,
    );
    expect(service.reviewQueue).toHaveBeenLastCalledWith({
      group: "all",
      position,
      sort: "name",
    });
  });

  it("refuses a cursor it did not produce instead of restarting the list", async () => {
    const { queue, service } = setup();
    await expect(
      queue.execute(
        { cursor: "not-a-cursor", group: "all", sort: "oldest" },
        context,
      ),
    ).resolves.toMatchObject({ error: "invalid_request", ok: false });
    expect(service.reviewQueue).not.toHaveBeenCalled();
  });
});

describe("creator review read operation", () => {
  it("is for reviewers only and refuses a missing actor", async () => {
    const { read, service } = setup();
    expect(read.access).toEqual({
      capability: "creator:review",
      kind: "platform",
    });
    await expect(
      read.execute({ applicationId: row.applicationId }, anonymous),
    ).resolves.toMatchObject({ error: "unauthorized", ok: false });
    expect(service.readForReview).not.toHaveBeenCalled();
  });

  it("returns the sent version and its history in wire form", async () => {
    const { read, service } = setup();
    const result = await read.execute(
      { applicationId: row.applicationId },
      context,
    );
    expect(service.readForReview).toHaveBeenCalledWith(row.applicationId);
    if (!result.ok) throw new Error("Expected a detail");
    expect(result.value.application.events[0]?.createdAt).toBe(
      "2026-10-10T12:30:00.000Z",
    );
    expect(
      creatorReviewReadResponseSchema.safeParse(result.value).success,
    ).toBe(true);
  });

  it("answers not found for an application that does not exist", async () => {
    const { read, service } = setup();
    service.readForReview.mockResolvedValueOnce(null);
    await expect(
      read.execute({ applicationId: row.applicationId }, context),
    ).resolves.toMatchObject({ error: "not_found", ok: false });
  });
});
