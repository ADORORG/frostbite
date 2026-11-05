import { oldBrand, type NewBrand } from "./brand.ts";

// One rule rewrites one form of the old name. They run in this order, each on the output of the one before, and every pattern says what may
// stand on either side of the old name, so a longer word that merely contains it (a GitHub organisation, a protocol constant) is never touched.
export interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

const word = oldBrand.slug;
const beforeWord = "A-Za-z0-9_";

export function buildRules(brand: NewBrand): readonly Rule[] {
  const rule = (name: string, source: string, replacement: string): Rule => ({
    name,
    pattern: new RegExp(source, "gu"),
    replacement,
  });
  return [
    // `@ador/game-sdk`, and `@ador` on its own; not `@adororg`.
    rule(
      "package scope",
      `(?<![${beforeWord}])${oldBrand.scope}(?![${beforeWord}-])`,
      brand.scope,
    ),
    // `ador-game`, `ador-stack-postgres`, `ador-session`, `__Host-ador-session`, `ador-drafts`.
    rule("hyphenated names", `(?<![${beforeWord}])${word}-`, `${brand.slug}-`),
    // `ador:game:<id>:progress`, `ador:balance`.
    rule(
      "storage keys",
      `(?<![${beforeWord}@])${word}:(?=[a-z])`,
      `${brand.slug}:`,
    ),
    // `ador.auth_sessions`, `ador.database.migrations`.
    rule(
      "schema-qualified names",
      `(?<![${beforeWord}@/.-])${word}\\.(?=[a-z_])`,
      `${brand.slug}.`,
    ),
    // `ador_test`.
    rule(
      "underscored names",
      `(?<![${beforeWord}])${word}_(?=[a-z])`,
      `${brand.slug}_`,
    ),
    // `__adorReplay`, `__adorSample`, `__adorMeta`: names the verifier bundle defines.
    rule(
      "generated identifiers",
      `(?<![A-Za-z0-9])${word}(?=[A-Z][a-z])`,
      brand.slug,
    ),
    // "Ador" as a person reads it.
    rule("display name", `\\b${oldBrand.display}\\b`, brand.display),
    // The wallet of the local regtest node, named in a URL.
    rule("regtest wallet", `(?<=/wallet/)${word}\\b`, brand.slug),
    // What is left: the schema's own name, a name in a sentence.
    rule(
      "bare name",
      `(?<![${beforeWord}@/.:-])${word}(?![${beforeWord}.:-])`,
      brand.slug,
    ),
  ];
}

export interface Rewritten {
  readonly counts: Readonly<Record<string, number>>;
  readonly text: string;
}

export function rewriteText(text: string, rules: readonly Rule[]): Rewritten {
  const counts: Record<string, number> = {};
  let current = text;
  for (const { name, pattern, replacement } of rules)
    current = current.replace(pattern, () => {
      counts[name] = (counts[name] ?? 0) + 1;
      return replacement;
    });
  return { counts, text: current };
}

// Forms of the old name that are meant to stay, and why: the GitHub organisation (`ADORORG`, in the image address and the repository's URL,
// which a rename here cannot change), and the versioned protocol constants (`ADOR_ALLOWLIST_LEAF_V1`, `ADOR_CLAIM_ACTION_V1`), the domain
// separation of hashes and signed messages, shared with a Rust spike: renaming one changes every allowlist root and every message that
// was signed with it.
const kept = [/ADOR_[A-Z0-9_]*_V[0-9]+/gu, new RegExp(`${word}org`, "giu")];
const leftoverWord = new RegExp(`(?<![A-Za-z])${word}(?![a-z])`, "iu");
const leftoverCamel = new RegExp(`${word}[A-Z]`, "u");

export interface Leftover {
  readonly line: number;
  readonly text: string;
}

// Where the old name still stands in `text`, once the forms that are meant to stay are set aside.
export function findLeftovers(text: string): readonly Leftover[] {
  let rest = text;
  for (const pattern of kept) rest = rest.replace(pattern, "");
  const found: Leftover[] = [];
  for (const [index, line] of rest.split("\n").entries())
    if (leftoverWord.test(line) || leftoverCamel.test(line))
      found.push({ line: index + 1, text: line.trim().slice(0, 160) });
  return found;
}
