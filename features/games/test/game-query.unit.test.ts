import { describe, expect, it } from "vitest";

import {
  emptyGameQuery,
  gameQueryString,
  isEmptyQuery,
  parseGameQuery,
  queryTextLimit,
  searchParamsOf,
} from "../src/domain/game-query.ts";

const parse = (search: string) => parseGameQuery(new URLSearchParams(search));

describe("reading a games address", () => {
  it("reads words, kinds and playable", () => {
    expect(parse("q=snow+dash&kind=puzzle&kind=arcade&playable=1")).toEqual({
      kinds: ["arcade", "puzzle"],
      playable: true,
      text: "snow dash",
    });
  });

  it("gives the empty query for an address with nothing in it", () => {
    expect(parse("")).toEqual(emptyGameQuery);
    expect(isEmptyQuery(parse(""))).toBe(true);
  });

  it("collapses and trims the spaces in the words", () => {
    expect(parse("q=%20%20frost%20%20%20runner%20").text).toBe("frost runner");
  });

  it("cuts the words at the limit and does not leave a space at the cut", () => {
    const long = parse(`q=${"ab ".repeat(100)}`).text;
    expect(long.length).toBeLessThanOrEqual(queryTextLimit);
    expect(long).toBe(long.trim());
  });

  it("cuts by characters, so a picture at the cut is not split in half", () => {
    const text = `${"a".repeat(queryTextLimit - 1)}😀😀😀`;
    const cut = parse(`q=${encodeURIComponent(text)}`).text;
    expect(cut).toBe(`${"a".repeat(queryTextLimit - 1)}😀`);
    // What was kept reads back as itself: nothing in it is half of anything.
    expect(parse(gameQueryString({ ...emptyGameQuery, text: cut })).text).toBe(
      cut,
    );
  });

  it("drops a kind the platform does not have, and a kind given twice", () => {
    expect(
      parse("kind=nope&kind=puzzle&kind=puzzle&kind=%3Cscript%3E").kinds,
    ).toEqual(["puzzle"]);
  });

  it("drops a tag that is not a kind of game to filter by, though the platform has it", () => {
    expect(parse("kind=endless&kind=developer&kind=platformer").kinds).toEqual(
      [],
    );
  });

  it("puts kinds in the platform's order, whatever order they came in", () => {
    expect(parse("kind=rhythm&kind=action").kinds).toEqual([
      "action",
      "rhythm",
    ]);
  });

  it("is playable only for exactly 1", () => {
    expect(parse("playable=1").playable).toBe(true);
    for (const value of ["0", "true", "", "yes"])
      expect(parse(`playable=${value}`).playable).toBe(false);
  });

  it("ignores everything else in the address", () => {
    expect(parse("utm_source=x&session=abc")).toEqual(emptyGameQuery);
  });

  it("takes the first of a name given twice for words", () => {
    expect(parse("q=first&q=second").text).toBe("first");
  });
});

describe("writing a games address", () => {
  it("is empty for the empty query, so the plain page keeps its plain address", () => {
    expect(gameQueryString(emptyGameQuery)).toBe("");
  });

  it("writes words, kinds and playable, escaped", () => {
    expect(
      gameQueryString({
        kinds: ["arcade", "puzzle"],
        playable: true,
        text: "a&b=c d",
      }),
    ).toBe("q=a%26b%3Dc+d&kind=arcade&kind=puzzle&playable=1");
  });

  it("writes no words for spaces alone, and counts a box of spaces as empty", () => {
    const spaces = { ...emptyGameQuery, text: "   " };
    expect(gameQueryString(spaces)).toBe("");
    expect(isEmptyQuery(spaces)).toBe(true);
    expect(isEmptyQuery({ ...spaces, playable: true })).toBe(false);
  });

  it("reads back what it wrote", () => {
    const query = {
      kinds: ["arcade" as const],
      playable: true,
      text: "café ☃",
    };
    expect(parse(gameQueryString(query))).toEqual(query);
  });
});

describe("the framework's query record", () => {
  it("becomes the same address as the browser would give", () => {
    const params = searchParamsOf({
      playable: "1",
      q: "snow",
      skipped: undefined,
      kind: ["puzzle", "arcade"],
    });
    expect(parseGameQuery(params)).toEqual({
      kinds: ["arcade", "puzzle"],
      playable: true,
      text: "snow",
    });
  });
});
