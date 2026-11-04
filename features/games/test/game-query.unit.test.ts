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
  it("reads words, tags and playable", () => {
    expect(parse("q=snow+dash&tag=puzzle&tag=arcade&playable=1")).toEqual({
      playable: true,
      tags: ["arcade", "puzzle"],
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

  it("drops a tag the platform does not have, and a tag given twice", () => {
    expect(
      parse("tag=nope&tag=puzzle&tag=puzzle&tag=%3Cscript%3E").tags,
    ).toEqual(["puzzle"]);
  });

  it("puts tags in the platform's order, whatever order they came in", () => {
    expect(parse("tag=rhythm&tag=action").tags).toEqual(["action", "rhythm"]);
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

  it("writes words, tags and playable, escaped", () => {
    expect(
      gameQueryString({
        playable: true,
        tags: ["arcade", "puzzle"],
        text: "a&b=c d",
      }),
    ).toBe("q=a%26b%3Dc+d&tag=arcade&tag=puzzle&playable=1");
  });

  it("writes no words for spaces alone, and counts a box of spaces as empty", () => {
    const spaces = { ...emptyGameQuery, text: "   " };
    expect(gameQueryString(spaces)).toBe("");
    expect(isEmptyQuery(spaces)).toBe(true);
    expect(isEmptyQuery({ ...spaces, playable: true })).toBe(false);
  });

  it("reads back what it wrote", () => {
    const query = {
      playable: true,
      tags: ["endless" as const],
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
      tag: ["puzzle", "arcade"],
    });
    expect(parseGameQuery(params)).toEqual({
      playable: true,
      tags: ["arcade", "puzzle"],
      text: "snow",
    });
  });
});
