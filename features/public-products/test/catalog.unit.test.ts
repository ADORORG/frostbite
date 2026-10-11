import { describe, expect, it } from "vitest";

import { parseProductSlug, productCatalogs } from "../src/domain/catalog.ts";

describe("public product catalog", () => {
  it("defines every public catalog once", () => {
    expect(productCatalogs.map(({ path }) => path)).toEqual([
      "/launches",
      "/creators",
    ]);
  });

  it.each(["orbit", "orbit-one", "1-bit-game"])(
    "accepts safe slug %s",
    (slug) => {
      expect(parseProductSlug(slug)).toBe(slug);
    },
  );

  it.each([undefined, "", "Orbit", "two words", "../admin", "end-"])(
    "rejects unsafe slug %s",
    (slug) => {
      expect(parseProductSlug(slug)).toBeNull();
    },
  );
});
