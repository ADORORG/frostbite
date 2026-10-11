import { describe, expect, it } from "vitest";

import {
  creatorReviewGroupStates,
  creatorReviewGroups,
  creatorReviewQueueInputSchema,
  creatorApplicationStates,
  decodeCreatorReviewCursor,
  encodeCreatorReviewCursor,
  statesInGroup,
} from "../src/creator-admission/index.ts";

const id = "018f22f2-9c1a-7b21-8c45-0000000000f1";
const encode = (value: object) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

describe("creator review cursor", () => {
  it.each(["2026-10-10T12:30:00.000Z", "ada maker", "été ñ ✓", "a+/=b"])(
    "carries the position %s through encode and decode",
    (key) => {
      const cursor = encodeCreatorReviewCursor({ id, key });
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
      expect(decodeCreatorReviewCursor(cursor)).toEqual({ id, key });
    },
  );

  it.each([
    ["not base64", "%%%"],
    ["not json", btoa("nope")],
    ["bytes that are not text", btoa("\xff\xfe\xfd")],
    ["not a pair", encode(["only-a-key"])],
    ["an object", encode({ id, key: "x" })],
    ["a number key", encode([1, id])],
    ["an empty key", encode(["", id])],
    ["an oversized key", encode(["x".repeat(201), id])],
    ["a key the database cannot store", encode(["a\u0000b", id])],
    ["an id that is not a UUIDv7", encode(["x", "1234"])],
    ["a third element", encode(["x", id, "extra"])],
  ])("refuses %s", (_label, cursor) => {
    expect(decodeCreatorReviewCursor(cursor)).toBeNull();
  });
});

describe("creator review groups", () => {
  it("puts every state a sent application can be in into exactly one named group", () => {
    const named = Object.values(creatorReviewGroupStates).flat();
    expect(new Set(named).size).toBe(named.length);
    expect(new Set(statesInGroup("all"))).toEqual(
      new Set(creatorApplicationStates.filter((state) => state !== "draft")),
    );
    for (const group of creatorReviewGroups) {
      expect(statesInGroup(group).length).toBeGreaterThan(0);
    }
  });
});

describe("creator review queue input", () => {
  it("accepts a first page and refuses an unknown group, order, or stray field", () => {
    const first = { cursor: null, group: "all", sort: "oldest" };
    expect(creatorReviewQueueInputSchema.safeParse(first).success).toBe(true);
    for (const bad of [
      { ...first, group: "everything" },
      { ...first, sort: "random" },
      { ...first, extra: 1 },
      { ...first, cursor: "short" },
      { ...first, cursor: "has spaces in it!" },
    ]) {
      expect(creatorReviewQueueInputSchema.safeParse(bad).success).toBe(false);
    }
  });
});
