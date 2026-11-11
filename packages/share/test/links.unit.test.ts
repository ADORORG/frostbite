import { describe, expect, it } from "vitest";

import { shareConfigSchema } from "../src/config.ts";
import { countedLinkLength, fitText, platformLink } from "../src/links.ts";
import { config } from "./fixtures.ts";

const [x, chat] = config.platforms;
if (x === undefined || chat === undefined) throw new Error("fixture");
const url = "https://play.example/s/0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";

describe("the link to a destination", () => {
  it("puts the words and the link in the template, each percent-encoded", () => {
    const link = platformLink(x, { hashtags: [], text: "A & B #1\nnext", url });
    const query = new URL(link).searchParams;
    expect(query.get("text")).toBe("A & B #1\nnext");
    expect(query.get("url")).toBe(url);
    expect([...query.keys()]).toEqual(["text", "url"]);
  });

  it("fills a one-field destination with the words and the link together", () => {
    const link = platformLink(chat, { hashtags: [], text: "Hello", url });
    expect(new URL(link).searchParams.get("text")).toBe(`Hello ${url}`);
  });

  it("adds the hashtags after the words", () => {
    const link = platformLink(x, {
      hashtags: ["Frostbite", "Play"],
      text: "Hi",
      url,
    });
    expect(new URL(link).searchParams.get("text")).toBe("Hi #Frostbite #Play");
  });
});

describe("fitting words to a destination's limit", () => {
  const words = "w".repeat(400);

  it("leaves words alone when they fit, or when there is no limit", () => {
    expect(fitText({ hashtags: [], text: "short", url }, 280)).toBe("short");
    expect(fitText({ hashtags: [], text: words, url }, undefined)).toBe(words);
  });

  it("cuts to leave room for the link and the hashtags, and marks the cut", () => {
    const fitted = fitText({ hashtags: ["Frostbite"], text: words, url }, 280);
    expect(fitted.endsWith("… #Frostbite")).toBe(true);
    const total = fitted.length + 1 + countedLinkLength;
    expect(total).toBeLessThanOrEqual(280);
    expect(total).toBeGreaterThan(280 - 3);
  });

  it("never goes negative when the limit is smaller than the link and tags", () => {
    expect(fitText({ hashtags: ["Frostbite"], text: words, url }, 10)).toBe(
      "… #Frostbite",
    );
  });
});

describe("a configuration", () => {
  const good = {
    hashtags: [],
    platforms: [
      {
        accent: "#112233",
        id: "a",
        label: "A",
        mark: "a",
        template: "https://a.example/?u={url}",
      },
    ],
  };

  it("accepts a good one", () => {
    expect(shareConfigSchema.safeParse(good).success).toBe(true);
  });

  it.each([
    [
      "an address that is not https",
      {
        ...good,
        platforms: [
          {
            accent: "#112233",
            id: "a",
            label: "A",
            mark: "a",
            template: "http://a.example/?u={url}",
          },
        ],
      },
    ],
    [
      "a template that carries no link",
      {
        ...good,
        platforms: [
          {
            accent: "#112233",
            id: "a",
            label: "A",
            mark: "a",
            template: "https://a.example/?t={text}",
          },
        ],
      },
    ],
    ["no destinations", { ...good, platforms: [] }],
    [
      "the same id twice",
      { ...good, platforms: [good.platforms[0], good.platforms[0]] },
    ],
    ["a hashtag with a space", { ...good, hashtags: ["two words"] }],
    ["a field it does not know", { ...good, extra: true }],
  ])("refuses %s", (_name, bad) => {
    expect(shareConfigSchema.safeParse(bad).success).toBe(false);
  });
});
