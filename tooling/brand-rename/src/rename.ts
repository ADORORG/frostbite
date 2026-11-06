import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { checkBrand, type NewBrand } from "./brand.ts";
import { isExcluded, isText, trackedFiles } from "./files.ts";
import {
  buildRules,
  findLeftovers,
  rewriteText,
  type Leftover,
} from "./rules.ts";

export interface Remaining extends Leftover {
  readonly file: string;
}

export interface RenameReport {
  // The files that changed (or would change, in a dry run), and how many times each rule fired.
  readonly changed: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  // Files not looked at: excluded by name, or not text.
  readonly excluded: number;
  readonly binary: number;
  // Where the old name still stands after the rewrite.
  readonly remaining: readonly Remaining[];
}

interface Options {
  readonly root: string;
  // Defaults to every tracked file; a test gives its own list.
  readonly files?: readonly string[];
}

async function readText(
  root: string,
  file: string,
): Promise<string | "binary"> {
  const content = await readFile(join(root, file));
  return isText(content) ? content.toString("utf8") : "binary";
}

// Rewrites every old form of the name in the tracked text files. With `dryRun` nothing is written, and the report says what would be.
export async function runRename(
  options: Options & { readonly brand: NewBrand; readonly dryRun: boolean },
): Promise<RenameReport> {
  const rules = buildRules(checkBrand(options.brand));
  const changed: string[] = [];
  const counts: Record<string, number> = {};
  const remaining: Remaining[] = [];
  let excluded = 0;
  let binary = 0;
  for (const file of options.files ?? trackedFiles(options.root)) {
    if (isExcluded(file)) {
      excluded += 1;
      continue;
    }
    const text = await readText(options.root, file);
    if (text === "binary") {
      binary += 1;
      continue;
    }
    const rewritten = rewriteText(text, rules);
    for (const [name, count] of Object.entries(rewritten.counts))
      counts[name] = (counts[name] ?? 0) + count;
    if (rewritten.text !== text) {
      changed.push(file);
      if (!options.dryRun)
        await writeFile(join(options.root, file), rewritten.text);
    }
    for (const left of findLeftovers(rewritten.text))
      remaining.push({ file, ...left });
  }
  return { binary, changed, counts, excluded, remaining };
}

// Where the old name stands in the files as they are now, for a check that a rename missed nothing.
export async function findRemaining(
  options: Options,
): Promise<readonly Remaining[]> {
  const remaining: Remaining[] = [];
  for (const file of options.files ?? trackedFiles(options.root)) {
    if (isExcluded(file)) continue;
    const text = await readText(options.root, file);
    if (text === "binary") continue;
    for (const left of findLeftovers(text)) remaining.push({ file, ...left });
  }
  return remaining;
}
