import { describe, expect, it } from "vitest";

import { checkBrand } from "../src/brand.ts";
import { isExcluded, isText } from "../src/files.ts";

describe("what a rename leaves alone", () => {
  it.each([
    "pnpm-lock.yaml",
    "packages/database/migrations/20261024_x/migration.sql",
    "packages/database/migrations/20261024_x/snapshot.json",
    "tooling/brand-rename/src/rules.ts",
    "some/other/place/snapshot.json",
  ])("leaves %s", (path) => {
    expect(isExcluded(path)).toBe(true);
  });

  it.each([
    "packages/database/src/schema/platform.ts",
    "packages/database/migrations-notes.md",
    "apps/web/pnpm-lock.yaml.md",
    "tooling/game-tools/src/scaffold.ts",
    "README.md",
  ])("rewrites %s", (path) => {
    expect(isExcluded(path)).toBe(false);
  });

  it("takes a file for text unless a NUL byte is in its first 8 KiB", () => {
    expect(isText(Buffer.from("plain text"))).toBe(true);
    expect(isText(Buffer.from([0x89, 0x50, 0x00, 0x47]))).toBe(false);
    const late = Buffer.alloc(9000, 0x61);
    late[8500] = 0;
    expect(isText(late)).toBe(true);
    const early = Buffer.alloc(9000, 0x61);
    early[8191] = 0;
    expect(isText(early)).toBe(false);
  });
});

describe("the new name", () => {
  const good = { display: "Frostbite", scope: "@frostbite", slug: "frostbite" };

  it("is accepted when it is well formed and does not contain the old name", () => {
    expect(checkBrand(good)).toBe(good);
  });

  it.each([
    ["a scope without an @", { ...good, scope: "frostbite" }],
    ["a scope in capitals", { ...good, scope: "@Frostbite" }],
    ["a slug that starts with a digit", { ...good, slug: "1frostbite" }],
    ["a slug with a space", { ...good, slug: "frost bite" }],
    ["an empty display name", { ...good, display: "  " }],
    [
      "a display name that contains the old name",
      { ...good, display: "Adoring" },
    ],
    [
      "a slug that contains the old name",
      { ...good, scope: "@adorable", slug: "adorable" },
    ],
  ])("is refused for %s", (_what, brand) => {
    expect(() => checkBrand(brand)).toThrow();
  });
});
