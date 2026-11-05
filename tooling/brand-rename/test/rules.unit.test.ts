import { describe, expect, it } from "vitest";

import { buildRules, findLeftovers, rewriteText } from "../src/rules.ts";

const brand = {
  display: "Frostbite",
  scope: "@frostbite",
  slug: "frostbite",
} as const;
const rules = buildRules(brand);
const rewrite = (text: string) => rewriteText(text, rules).text;

describe("the rewrite rules", () => {
  it.each([
    [
      "a package import",
      'import { x } from "@ador/game-sdk/play";',
      'import { x } from "@frostbite/game-sdk/play";',
    ],
    [
      "a scope on its own",
      "publish under `@ador`.",
      "publish under `@frostbite`.",
    ],
    ["a hyphenated name", "ador-stack-postgres", "frostbite-stack-postgres"],
    ["a protocol channel", 'channel: "ador-game"', 'channel: "frostbite-game"'],
    [
      "a cookie with a prefix",
      "__Host-ador-session",
      "__Host-frostbite-session",
    ],
    [
      "a bucket name",
      "R2_PRIVATE_BUCKET=ador-drafts",
      "R2_PRIVATE_BUCKET=frostbite-drafts",
    ],
    [
      "a storage key",
      'localStorage.getItem("ador:game:g:progress")',
      'localStorage.getItem("frostbite:game:g:progress")',
    ],
    ["a balance key", 'prefix: "ador:balance"', 'prefix: "frostbite:balance"'],
    [
      "a schema-qualified table",
      "select * from ador.auth_sessions",
      "select * from frostbite.auth_sessions",
    ],
    [
      "a lock name",
      '"ador.database.migrations"',
      '"frostbite.database.migrations"',
    ],
    ["an underscored name", "ador_test", "frostbite_test"],
    [
      "a generated identifier",
      "globalThis.__adorReplay",
      "globalThis.__frostbiteReplay",
    ],
    ["a camel-case identifier", "adorInput", "frostbiteInput"],
    [
      "the display name",
      "Your Ador sign-in code",
      "Your Frostbite sign-in code",
    ],
    [
      "the regtest wallet in a URL",
      "http://127.0.0.1:18443/wallet/ador",
      "http://127.0.0.1:18443/wallet/frostbite",
    ],
    [
      "the bare schema name",
      'DATABASE_SCHEMA_NAME = "ador"',
      'DATABASE_SCHEMA_NAME = "frostbite"',
    ],
    [
      "a name in a sentence",
      "created the `ador` schema.",
      "created the `frostbite` schema.",
    ],
  ])("rewrites %s", (_what, before, after) => {
    expect(rewrite(before)).toBe(after);
  });

  it.each([
    "ghcr.io/adororg/frostbite:dev",
    "github.com/ADORORG",
    "publish under @adororg",
    "ADOR_ALLOWLIST_LEAF_V1",
    "ADOR_CLAIM_ACTION_V1",
    "an adorable thing",
    "adorn the page",
    "Adorn",
    "someone's ador-able",
    "a/path/ador/segment",
    "foo-ador",
  ])("leaves %j alone", (text) => {
    const expected =
      text === "someone's ador-able" ? "someone's frostbite-able" : text;
    expect(rewrite(text)).toBe(expected);
  });

  it("is safe to run twice: the second run changes nothing", () => {
    const sample = [
      'import "@ador/shared/chain";',
      "ador-stack-s3 and ador:game:x:progress",
      "from ador.game_runs where id = 1",
      "Ador, ador, `ador`",
    ].join("\n");
    const once = rewrite(sample);
    expect(rewrite(once)).toBe(once);
  });

  it("counts how many times each rule fired", () => {
    const { counts } = rewriteText('"@ador/a" "@ador/b" ador-x Ador', rules);
    expect(counts).toEqual({
      "display name": 1,
      "hyphenated names": 1,
      "package scope": 2,
    });
  });

  it("does not read a dollar sign in the new name as a replacement pattern", () => {
    const odd = buildRules({ display: "A$&B", scope: "@odd", slug: "odd" });
    expect(rewriteText("Your Ador code", odd).text).toBe("Your A$&B code");
  });
});

describe("finding what a rename missed", () => {
  it.each([
    ["a bare name", "the ador schema"],
    ["a name with a prefix", "ador-session"],
    ["a scope", "import x from '@ador/y'"],
    ["a capital name", "ADOR runs this"],
    ["an identifier", "const adorReplay = 1"],
    ["a name in a path", "a/path/ador/segment"],
    ["a name after an underscore", "ADOR_OTHER_CONSTANT"],
    ["a constant that is not versioned", "ADOR_CLAIM_ACTION"],
  ])("reports %s", (_what, text) => {
    expect(findLeftovers(text)).toHaveLength(1);
  });

  it.each([
    ["the GitHub organisation", "ghcr.io/adororg/frostbite:dev and ADORORG"],
    ["the allowlist domain constant", 'domain = "ADOR_ALLOWLIST_LEAF_V1"'],
    ["a signed-message domain constant", 'b"ADOR_CLAIM_ACTION_V1"'],
    ["a word that merely contains it", "an adorable adornment"],
    ["the new name", "@frostbite/game-sdk and frostbite-game"],
  ])("does not report %s", (_what, text) => {
    expect(findLeftovers(text)).toEqual([]);
  });

  it("says which line, and shows it trimmed", () => {
    expect(findLeftovers("fine\n   see ador here  \nfine")).toEqual([
      { line: 2, text: "see ador here" },
    ]);
  });
});
