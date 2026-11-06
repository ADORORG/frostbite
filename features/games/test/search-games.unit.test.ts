import { describe, expect, it } from "vitest";

import { emptyGameQuery, type GameQuery } from "../src/domain/game-query.ts";
import { searchGames } from "../src/domain/search-games.ts";
import { idsOf, shelf } from "./support/search-games.ts";

const find = (text: string, rest: Partial<GameQuery> = {}) =>
  idsOf(searchGames(shelf, { ...emptyGameQuery, ...rest, text }));

describe("searching the games", () => {
  it("gives every game, in the order registered, for the empty query", () => {
    expect(idsOf(searchGames(shelf, emptyGameQuery))).toEqual(idsOf(shelf));
    expect(find("   ")).toEqual(idsOf(shelf));
  });

  it("finds a word at the start of a word, not in the middle of one", () => {
    expect(find("run")).toEqual(["frost-runner"]);
    expect(find("unne")).toEqual([]);
  });

  it("needs every word asked for, in any order", () => {
    expect(find("runner frost")).toEqual(["frost-runner"]);
    expect(find("frost runner")).toEqual(["frost-runner"]);
    expect(find("frost puzzle")).toEqual([]);
  });

  it("ignores case and accents on both sides", () => {
    // The accent is inside the word, so a search that only matched the unaccented start would miss it.
    expect(find("creme")).toEqual(["shard-match"]);
    expect(find("BRULEE")).toEqual(["shard-match"]);
    expect(find("crème brûlée")).toEqual(["shard-match"]);
    expect(find("sNoWbAlL")).toEqual(["snowball-dash"]);
  });

  it("finds a title typed as one word or as two", () => {
    expect(find("frostbreaker")).toContain("frost-breaker");
    expect(find("frost breaker")).toEqual(["frost-breaker"]);
    expect(find("breaker")).toEqual(["frost-breaker"]);
  });

  it("looks in the tags, the summary, the description and the milestones", () => {
    expect(find("reflex")).toEqual(["frost-runner"]);
    expect(find("minefield")).toEqual(["frost-breaker"]);
    expect(find("frozen")).toEqual(["shard-match"]);
    expect(find("chain")).toEqual(["shard-match"]);
  });

  it("ranks a title above a tag above a summary above a description, whatever order the games were registered in", () => {
    // Each answer lists a game registered later ahead of one registered earlier, so only the places decide it.
    expect(find("strategy").slice(-2)).toEqual([
      "grand-strategy",
      "frost-breaker",
    ]);
    expect(find("arcade")).toEqual([
      "snowball-dash",
      "icicle-drop",
      "frost-breaker",
    ]);
    expect(find("dash")).toEqual(["snowball-dash", "frost-runner"]);
    // "friends" is in the description of an earlier game and the summary of a later one.
    expect(find("friends")).toEqual(["grand-strategy", "frost-runner"]);
  });

  it("keeps the order registered for games that score alike", () => {
    expect(find("endless")).toEqual(["frost-runner", "snowball-dash"]);
    expect(find("frost")).toEqual(["frost-runner", "frost-breaker"]);
  });

  it("puts a title that starts with the query above one that only holds it", () => {
    expect(find("strategy")).toEqual([
      "strategy-rush-hour",
      "strategy-rush",
      "grand-strategy",
      "frost-breaker",
    ]);
  });

  it("puts a title that is the whole query above one that only starts with it", () => {
    expect(find("strategy rush")).toEqual([
      "strategy-rush",
      "strategy-rush-hour",
    ]);
  });

  it("puts a title that starts with the query above a looser hit", () => {
    expect(find("snow")[0]).toBe("snowball-dash");
  });

  it("forgives a slipped letter in a title or a tag, but not in the body", () => {
    expect(find("snowbal")).toEqual(["snowball-dash"]);
    expect(find("snwoball")).toEqual(["snowball-dash"]);
    expect(find("shrad")).toEqual(["shard-match"]);
    expect(find("puzle")).toEqual(["shard-match", "icicle-drop"]);
    expect(find("minefeld")).toEqual([]);
  });

  it("does not forgive a short word or a different word", () => {
    expect(find("sand")).toEqual([]);
    expect(find("xyzzy")).toEqual([]);
    expect(find("zzz")).toEqual([]);
    expect(find("flost")).toEqual(["frost-runner", "frost-breaker"]);
    expect(find("snorkel")).toEqual([]);
  });

  it("takes characters that mean something to a pattern as plain text", () => {
    for (const text of ["(", "[a-z]+", "\\", "*", ".*", "a|b", "$^", "frost("])
      expect(() => find(text)).not.toThrow();
    // Nothing in them to look for: no games, not every game.
    expect(find(".*")).toEqual([]);
    expect(find("!!")).toEqual([]);
  });

  it("looks at the first few words only, so a long query cannot make the page work harder", () => {
    // The seventh word is nowhere in the game; it is not asked for.
    expect(find("frost runner frost runner frost runner zzzz")).toEqual([
      "frost-runner",
    ]);
  });

  it("ranks a whole word above the start of a longer word, and a plain start above a slip", () => {
    // "gleam" is the start of "gleaming" in an earlier description and a whole word in a later one.
    expect(find("gleam")).toEqual(["grand-strategy", "frost-runner"]);
    // "puzz" starts the tag "Puzzle" of two earlier games, and is one letter from the title "Pizza".
    expect(find("puzz")).toEqual(["shard-match", "icicle-drop", "pizza-party"]);
  });

  it("copes with a very long query", () => {
    expect(find("frost ".repeat(5_000))).toEqual([
      "frost-runner",
      "frost-breaker",
    ]);
  });

  it("keeps the games with any chosen tag", () => {
    expect(find("", { tags: ["puzzle"] })).toEqual([
      "shard-match",
      "icicle-drop",
    ]);
    expect(find("", { tags: ["puzzle", "strategy"] })).toEqual([
      "frost-breaker",
      "shard-match",
      "icicle-drop",
      "grand-strategy",
    ]);
  });

  it("keeps only the playable games when asked", () => {
    expect(find("", { playable: true })).not.toContain("icicle-drop");
    expect(find("", { playable: false })).toContain("icicle-drop");
  });

  it("combines words, tags and playable, each narrowing the last", () => {
    expect(find("ice", { tags: ["puzzle"] })).toEqual(["icicle-drop"]);
    expect(find("ice", { playable: true, tags: ["puzzle"] })).toEqual([]);
  });

  it("returns nothing, not everything, for a tag nobody has", () => {
    expect(find("", { tags: ["rhythm"] })).toEqual([]);
  });
});
