import { describe, expect, it } from "vitest";

import {
  gameFilterKinds,
  gameKindsOf,
  gameTagKind,
  gameTagLabels,
  gameTagLimit,
  gameTags,
  gameTagsSchema,
} from "../src/games/tags.ts";

describe("game tags", () => {
  it("names every tag once, in words a person reads", () => {
    const labels = gameTags.map((tag) => gameTagLabels[tag]);
    expect(labels.every((label) => label.trim() !== "")).toBe(true);
    // Two chips that read the same would look like one filter that does nothing.
    expect(new Set(labels.map((label) => label.toLowerCase())).size).toBe(
      gameTags.length,
    );
    expect(new Set(gameTags).size).toBe(gameTags.length);
  });

  it("puts every tag under a filter kind or under none, and every kind is some tag's", () => {
    expect(Object.keys(gameTagKind).sort()).toEqual([...gameTags].sort());
    for (const kind of gameFilterKinds) {
      // A kind is itself a tag, so its chip reads as the tag does, and something can be filtered by it.
      expect(gameTagKind[kind]).toBe(kind);
      expect(gameTags).toContain(kind);
    }
    expect(gameTagKind.developer).toBeNull();
    expect(gameTagKind.platformer).toBe("action");
    expect(gameTagKind.endless).toBe("arcade");
    expect(gameTagKind.reflex).toBe("arcade");
  });

  it("names the kinds of a game once each, in the filter's order, and none for a developer tool", () => {
    expect(gameKindsOf(["reflex", "endless", "arcade"])).toEqual(["arcade"]);
    expect(gameKindsOf(["strategy", "platformer", "action"])).toEqual([
      "action",
      "strategy",
    ]);
    expect(gameKindsOf(["developer"])).toEqual([]);
    expect(gameKindsOf([])).toEqual([]);
  });

  it("takes one tag up to the limit and no more", () => {
    expect(gameTagsSchema.safeParse(gameTags.slice(0, 1)).success).toBe(true);
    expect(
      gameTagsSchema.safeParse(gameTags.slice(0, gameTagLimit)).success,
    ).toBe(true);
    expect(
      gameTagsSchema.safeParse(gameTags.slice(0, gameTagLimit + 1)).success,
    ).toBe(false);
    expect(gameTagsSchema.safeParse([]).success).toBe(false);
  });
});
