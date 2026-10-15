import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Avatar } from "../src/components/avatar.tsx";
import { avatarPattern, fnv1a } from "../src/components/avatar-pattern.ts";

const addresses = [
  "tb1quh9vv9008jqcct245xc98rp73qkjjfapr5eya8",
  "tb1qmdts2hrqvgfek8lmk9365k3qh9dyy555s4h9xp",
  "tb1q2tvudr69nap5uu8f6f0hdymp6zngwllayqdqpn",
  "tb1qxe73fjmlmz9ca9g65pxakp90k8n9uxy4hccf9u",
];

describe("avatar pattern", () => {
  it("is the same for the same text and differs between addresses", () => {
    expect(avatarPattern(addresses[0] ?? "")).toEqual(
      avatarPattern(addresses[0] ?? ""),
    );
    const pictures = new Set(
      addresses.map((address) => JSON.stringify(avatarPattern(address))),
    );
    expect(pictures.size).toBe(addresses.length);
  });

  it("is mirrored left to right, five by five, and never empty", () => {
    for (const seed of [...addresses, "", "a"]) {
      const { cells, hue } = avatarPattern(seed);
      expect(cells).toHaveLength(5);
      for (const row of cells) {
        expect(row).toHaveLength(5);
        expect(row[0]).toBe(row[4]);
        expect(row[1]).toBe(row[3]);
      }
      expect(cells[2]?.[2]).toBe(true);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("hashes with a known FNV-1a value and gives independent numbers per salt", () => {
    // FNV-1a 32-bit of "a" is 0xe40c292c (published test vector).
    expect(fnv1a("a", 0)).toBe(0xe40c292c);
    expect(fnv1a("a", 1)).not.toBe(fnv1a("a", 0));
  });
});

describe("avatar", () => {
  it("draws the filled cells in the colour from the text", () => {
    const seed = addresses[0] ?? "";
    const { cells, hue } = avatarPattern(seed);
    const markup = renderToStaticMarkup(<Avatar seed={seed} />);
    const filled = cells.flat().filter(Boolean).length;
    expect(markup.match(/<rect/gu)).toHaveLength(filled);
    expect(markup).toContain(`hsl(${String(hue)} 85% 62%)`);
  });

  it("is decorative without a label and an image with one", () => {
    const plain = renderToStaticMarkup(<Avatar seed="x" />);
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain("role=");
    const named = renderToStaticMarkup(
      <Avatar label="Wallet picture" seed="x" size={48} />,
    );
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Wallet picture"');
    expect(named).toContain('width="48"');
    expect(named).not.toContain("aria-hidden");
  });
});
