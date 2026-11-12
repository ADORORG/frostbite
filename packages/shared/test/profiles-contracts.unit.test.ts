import { describe, expect, it } from "vitest";

import { myProfileHref } from "../src/profiles/index.ts";

describe("where My profile leads", () => {
  it("is the public page when the profile is shown", () => {
    expect(myProfileHref({ name: "glitchy_1", visible: true })).toBe(
      "/p/glitchy_1",
    );
  });

  it("is the setup page when the public page is off, since it would not be found", () => {
    expect(myProfileHref({ name: "glitchy_1", visible: false })).toBe(
      "/profile",
    );
  });

  it("is the setup page when there is no profile", () => {
    expect(myProfileHref(null)).toBe("/profile");
  });
});
