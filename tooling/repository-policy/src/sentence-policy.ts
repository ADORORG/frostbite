import { readFile } from "node:fs/promises";
import { relative } from "node:path";

// A user-facing sentence written in more than one place is how wording drifts: one copy is reworded and the other is not, and a page
// that matches the text stops working. So a sentence (a capitalised literal of five words or more, ending as a sentence ends) may be
// written once in production source and shared. Duplicates that already exist are recorded in a baseline that may only shrink, so the
// debt is visible and can never grow.
const sentenceLiteral = /"([A-Z][^"\n\\]*[.!?])"/gu;
const fewestWords = 5;
const productionSource =
  /^(?:features|packages)\/[^/]+\/src\/|^apps\/web\/src\//u;

export type SentenceBaseline = Readonly<Record<string, number>>;
export interface SentenceSource {
  readonly path: string;
  readonly text: string;
}

// Where each sentence is written, by the line it is on. Whitespace is normalised, so a sentence split across lines still counts as one.
export function sentenceSites(
  sources: readonly SentenceSource[],
): ReadonlyMap<string, readonly string[]> {
  const sites = new Map<string, string[]>();
  for (const { path, text } of sources) {
    text.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(sentenceLiteral)) {
        const sentence = (match[1] ?? "").split(/\s+/u).join(" ");
        if (sentence.split(" ").length < fewestWords) continue;
        sites.set(sentence, [
          ...(sites.get(sentence) ?? []),
          `${path}:${String(index + 1)}`,
        ]);
      }
    });
  }
  return sites;
}

export function findDuplicateSentences(
  sources: readonly SentenceSource[],
  baseline: SentenceBaseline,
): readonly string[] {
  const sites = sentenceSites(sources);
  const violations: string[] = [];
  for (const [sentence, where] of sites) {
    const allowed = baseline[sentence] ?? 1;
    if (where.length > allowed)
      violations.push(
        `"${sentence}" is written ${String(where.length)} times (${where.join(", ")}); write it once and share it${
          allowed > 1 ? ` (the baseline allows ${String(allowed)})` : ""
        }.`,
      );
    else if (allowed > 1 && where.length < allowed)
      violations.push(
        `The sentence baseline is out of date: "${sentence}" is now written ${String(where.length)} time(s), not ${String(allowed)}. Lower or remove its entry.`,
      );
  }
  for (const sentence of Object.keys(baseline))
    if (!sites.has(sentence))
      violations.push(
        `The sentence baseline is out of date: "${sentence}" is no longer written anywhere. Remove its entry.`,
      );
  return violations;
}

// The sentences that are written more than once, as the baseline that would allow exactly them.
export function baselineOf(
  sources: readonly SentenceSource[],
): SentenceBaseline {
  return Object.fromEntries(
    [...sentenceSites(sources)]
      .filter(([, where]) => where.length > 1)
      .map(([sentence, where]) => [sentence, where.length] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export async function readProductionSources(
  root: string,
  files: readonly string[],
): Promise<readonly SentenceSource[]> {
  const sources: SentenceSource[] = [];
  for (const file of files) {
    const path = relative(root, file);
    if (
      productionSource.test(path) &&
      /\.tsx?$/u.test(path) &&
      !/\.d\.ts$/u.test(path)
    )
      sources.push({ path, text: await readFile(file, "utf8") });
  }
  return sources;
}
