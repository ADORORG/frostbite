import { describe, expect, it } from "vitest";

import {
  activityCursorSchema,
  decodeActivityCursor,
  encodeActivityCursor,
  reviewActivityInputSchema,
  reviewActivityItemSchema,
  reviewActivityResponseSchema,
  reviewRoutes,
} from "../src/collections/index.ts";
import { routeContributionSchema } from "../src/features/manifest.ts";

const position = {
  createdAt: "2026-10-10T12:00:00.000Z",
  id: "018f22f2-9c1a-7b21-8c45-000000000001",
};

describe("activity cursor", () => {
  it("round-trips the position of an event, and is URL-safe and opaque", () => {
    const cursor = encodeActivityCursor(position);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(cursor).not.toContain(position.id);
    expect(decodeActivityCursor(cursor)).toEqual(position);
    expect(activityCursorSchema.safeParse(cursor).success).toBe(true);
  });

  it("is unique per position", () => {
    const other = encodeActivityCursor({
      ...position,
      id: "018f22f2-9c1a-7b21-8c45-000000000002",
    });
    expect(other).not.toBe(encodeActivityCursor(position));
  });

  it.each([
    ["not base64 at all", "!!!!!!!!!!!!!!!!!!!!!!!!"],
    ["too short", "abc"],
    [
      "a different separator",
      encodeActivityCursor(position).replace(/./u, "A"),
    ],
    [
      "valid base64 of plain text",
      btoa("hello there, this is not a cursor value"),
    ],
    ["a bad time", btoa(`not-a-time|${position.id}`).replaceAll("=", "")],
    [
      "a bad id",
      btoa(`${position.createdAt}|not-an-id-at-all-but-long-enough`).replaceAll(
        "=",
        "",
      ),
    ],
    [
      "an extra part",
      btoa(`${position.createdAt}|${position.id}|extra`).replaceAll("=", ""),
    ],
    ["too long", "A".repeat(300)],
  ])("refuses %s", (_name, cursor) => {
    expect(decodeActivityCursor(cursor)).toBeNull();
  });
});

describe("activity contracts", () => {
  const item = {
    action: "approve",
    actorName: "Reviewer",
    actorUserId: position.id,
    collectionId: position.id,
    collectionName: "First light",
    createdAt: position.createdAt,
    eventId: position.id,
    nextState: "approved",
    previousState: "under-review",
    reasonCode: "reviewer-approved",
    sequence: 1,
    submissionId: position.id,
  };

  it("accepts an item, refuses extra fields (so private notes cannot ride along), and a submit has no previous state", () => {
    expect(reviewActivityItemSchema.safeParse(item).success).toBe(true);
    expect(
      reviewActivityItemSchema.safeParse({ ...item, privateNotes: "x" })
        .success,
    ).toBe(false);
    expect(
      reviewActivityItemSchema.safeParse({
        ...item,
        action: "submit",
        previousState: null,
        nextState: "submitted",
      }).success,
    ).toBe(true);
  });

  it("takes no cursor for the first page and a valid one afterwards", () => {
    expect(reviewActivityInputSchema.safeParse({ cursor: null }).success).toBe(
      true,
    );
    expect(
      reviewActivityInputSchema.safeParse({
        cursor: encodeActivityCursor(position),
      }).success,
    ).toBe(true);
    expect(reviewActivityInputSchema.safeParse({ cursor: "bad" }).success).toBe(
      false,
    );
    // A GET names no cursor for the first page: leaving it out means the same as null.
    expect(reviewActivityInputSchema.parse({})).toEqual({ cursor: null });
  });

  it("answers with items and the cursor of the next page, or none at the end", () => {
    expect(
      reviewActivityResponseSchema.safeParse({
        items: [item],
        nextCursor: null,
      }).success,
    ).toBe(true);
    expect(
      reviewActivityResponseSchema.safeParse({
        items: [],
        nextCursor: encodeActivityCursor(position),
      }).success,
    ).toBe(true);
  });

  it("is a valid manifest route", () => {
    expect(
      routeContributionSchema.safeParse(reviewRoutes.activity).success,
    ).toBe(true);
    expect(reviewRoutes.activity.path).toBe(
      "/api/v1/collection-reviews/activity",
    );
  });
});
