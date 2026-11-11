import { privatePage } from "@frostbite/plugin-kit/page-metadata";
import { describe, expect, it } from "vitest";

import { profileMetadata } from "../src/metadata.ts";

describe("a profile page's metadata", () => {
  it("names the player and says what the page holds, for a link preview", () => {
    expect(
      profileMetadata({
        avatar: "fox",
        bests: [],
        memberSince: "2026-10-01T00:00:00.000Z",
        mints: [],
        name: "IceAda",
      }),
    ).toEqual({
      description: "IceAda's verified high scores and minted milestones.",
      kind: "shared",
      title: "IceAda's player card",
    });
  });

  it("says nothing, and is kept out of search, for a name nobody shows", () => {
    expect(profileMetadata(null)).toBe(privatePage);
  });
});
