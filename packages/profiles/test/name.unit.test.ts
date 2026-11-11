import { describe, expect, it } from "vitest";

import { nameKeyOf, nameProblem, normalizedForBlocklist } from "../src/name.ts";
import { policy } from "./policy.ts";

describe("what a profile name may be", () => {
  it.each(["Ada", "ada_99", "Player-One", "a1b", "X".repeat(20), "7seven"])(
    "accepts %s",
    (name) => {
      expect(nameProblem(name, policy)).toBeNull();
    },
  );

  it.each([
    ["", "too-short"],
    ["ab", "too-short"],
    ["X".repeat(21), "too-long"],
    ["has space", "bad-characters"],
    ["_leading", "bad-characters"],
    ["-leading", "bad-characters"],
    ["emoji😀name", "bad-characters"],
    ["dot.name", "bad-characters"],
    ["<b>bold</b>", "bad-characters"],
    ["név", "bad-characters"],
  ] as const)("refuses %j as %s", (name, reason) => {
    expect(nameProblem(name, policy)).toBe(reason);
  });

  it("counts the length on the name as typed, and does not trim", () => {
    expect(nameProblem(" ab", policy)).toBe("bad-characters");
    expect(nameProblem("abc", policy)).toBeNull();
  });

  it("refuses a blocked word wherever it sits, in any case, with separators and look-alike digits", () => {
    for (const name of [
      "admin",
      "ADMIN",
      "the_admin",
      "xx-Admin-xx",
      "adm1n",
      "4dm1n",
      "fr0stb1t",
      "Frostbit_Official",
      "s7aff",
    ])
      expect(nameProblem(name, policy), name).toBe("blocked");
  });

  it("does not block a name that only resembles a blocked word", () => {
    for (const name of ["adam", "frost", "stuff", "bit"])
      expect(nameProblem(name, policy), name).toBeNull();
  });

  it("reads look-alike digits as letters only to look for blocked words", () => {
    expect(normalizedForBlocklist("Fr0st_B1t")).toBe("frostbit");
    expect(normalizedForBlocklist("2plus2")).toBe("2plus2");
  });

  it("keeps a name unique on its lower case", () => {
    expect(nameKeyOf("Ada")).toBe(nameKeyOf("aDA"));
    expect(nameKeyOf("Ada")).toBe("ada");
  });
});
