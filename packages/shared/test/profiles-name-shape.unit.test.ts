import { describe, expect, it } from "vitest";

import {
  isProfileAvatarId,
  nameShapeProblem,
  profileAvatarIds,
} from "../src/profiles/index.ts";

const bounds = { maxLength: 20, minLength: 3 };

describe("the shape of a profile name", () => {
  it.each(["Ada", "ada_99", "a-b", "7seven", "X".repeat(20)])(
    "accepts %s",
    (name) => {
      expect(nameShapeProblem(name, bounds)).toBeNull();
    },
  );

  it.each([
    ["", "too-short"],
    ["ab", "too-short"],
    ["X".repeat(21), "too-long"],
    ["a b", "bad-characters"],
    ["_ab", "bad-characters"],
    ["-ab", "bad-characters"],
    ["ab!", "bad-characters"],
    ["név", "bad-characters"],
    ["!", "bad-characters"],
  ] as const)("refuses %j as %s", (name, reason) => {
    expect(nameShapeProblem(name, bounds)).toBe(reason);
  });

  it("follows the bounds it is given", () => {
    expect(nameShapeProblem("abcd", { maxLength: 3, minLength: 1 })).toBe(
      "too-long",
    );
    expect(nameShapeProblem("a", { maxLength: 3, minLength: 1 })).toBeNull();
  });
});

describe("the preset avatars", () => {
  it("are twelve distinct ids, and only those are avatars", () => {
    expect(new Set(profileAvatarIds).size).toBe(profileAvatarIds.length);
    expect(profileAvatarIds).toHaveLength(12);
    for (const id of profileAvatarIds) expect(isProfileAvatarId(id)).toBe(true);
    expect(isProfileAvatarId("hacker")).toBe(false);
    expect(isProfileAvatarId("")).toBe(false);
  });
});
