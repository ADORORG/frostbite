import { describe, expect, it } from "vitest";

import {
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
