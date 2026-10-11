import type { ReviewActivityRecord } from "@ador/collections";
import { decodeActivityCursor } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import { presentActivity } from "../src/application/present.ts";
import { id } from "./support/fixtures.ts";

const at = new Date("2026-10-10T12:00:00.000Z");
const record = (
  overrides: Partial<ReviewActivityRecord> = {},
): ReviewActivityRecord => ({
  action: "approve",
  actorName: "Rita Reviewer",
  actorUserId: id(),
  collectionId: id(),
  collectionName: "First light",
  createdAt: at,
  eventId: id(),
  nextState: "approved",
  previousState: "under-review",
  reasonCode: "reviewer-approved",
  sequence: 2,
  submissionId: id(),
  ...overrides,
});

describe("presenting a page of the activity log", () => {
  it("copies each event as the contract defines it, with the time as text", () => {
    const item = record();
    const { items } = presentActivity({ items: [item], next: null });
    expect(items).toEqual([
      {
        action: "approve",
        actorName: "Rita Reviewer",
        actorUserId: item.actorUserId,
        collectionId: item.collectionId,
        collectionName: "First light",
        createdAt: "2026-10-10T12:00:00.000Z",
        eventId: item.eventId,
        nextState: "approved",
        previousState: "under-review",
        reasonCode: "reviewer-approved",
        sequence: 2,
        submissionId: item.submissionId,
      },
    ]);
  });

  it("ends the log with no cursor, and otherwise hands out the position of the next, older page", () => {
    expect(presentActivity({ items: [], next: null }).nextCursor).toBeNull();
    const next = { createdAt: at, id: id() };
    const { nextCursor } = presentActivity({ items: [record()], next });
    expect(nextCursor).not.toBeNull();
    expect(decodeActivityCursor(nextCursor ?? "")).toEqual({
      createdAt: "2026-10-10T12:00:00.000Z",
      id: next.id,
    });
  });
});
