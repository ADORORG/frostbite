import { describe, expect, it } from "vitest";

import { editDistance, withinTypo } from "../src/domain/typo.ts";

describe("edit distance", () => {
  it.each([
    ["", "", 0],
    ["abc", "abc", 0],
    ["abc", "", 3],
    ["", "abc", 3],
    ["snowball", "snowbal", 1],
    ["snowball", "snowbxll", 1],
    ["snowball", "snwoball", 1],
    ["abcd", "badc", 2],
    ["kitten", "sitting", 3],
  ])("%j to %j is %i", (a, b, distance) => {
    expect(editDistance(a, b)).toBe(distance);
    expect(editDistance(b, a)).toBe(distance);
  });
});

describe("forgiving a slipped word", () => {
  it("forgives one slip in a word of four to seven letters", () => {
    expect(withinTypo("shrad", "shard")).toBe(true);
    expect(withinTypo("shaxx", "shard")).toBe(false);
  });

  it("forgives two slips in a word of eight letters or more", () => {
    expect(withinTypo("snowbxlx", "snowball")).toBe(true);
    expect(withinTypo("snowbxxx", "snowball")).toBe(false);
  });

  it("forgives a slip in the start of a longer word", () => {
    expect(withinTypo("snwoba", "snowball")).toBe(true);
  });

  it("never forgives a word under four letters", () => {
    expect(withinTypo("ice", "ace")).toBe(false);
    expect(withinTypo("sand", "snow")).toBe(false);
  });
});
