import { describe, expect, it } from "vitest";

import { defineShareConfig, platformLink } from "../src/index.ts";
import { config } from "./fixtures.ts";

describe("a deployment's share configuration", () => {
  it("makes a working https address for every destination it lists", () => {
    for (const platform of config.platforms) {
      const link = new URL(
        platformLink(platform, {
          hashtags: config.hashtags,
          text: "Can you beat my 4,210?",
          url: "https://play.example/s/abc",
        }),
      );
      expect(link.protocol).toBe("https:");
      expect(decodeURIComponent(link.search)).toContain(
        "https://play.example/s/abc",
      );
    }
  });

  it("stops the platform at start when a template is wrong, naming the problem", () => {
    expect(() =>
      defineShareConfig({
        hashtags: [],
        platforms: [
          {
            accent: "#112233",
            id: "a",
            label: "A",
            mark: "a",
            template: "https://a.example/?t={text}",
          },
        ],
      }),
    ).toThrow(/must carry the link/u);
  });
});
