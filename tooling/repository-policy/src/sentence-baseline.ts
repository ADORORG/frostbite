import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import type { SentenceBaseline } from "./sentence-policy.ts";

// A sentence is in the baseline only because it is written more than once, so each count is at least two.
const baselineSchema = z.record(z.string().min(1), z.number().int().min(2));

export const sentenceBaselinePath = (root: string): string =>
  resolve(root, "tooling/repository-policy/sentence-baseline.json");

export async function readSentenceBaseline(
  root: string,
): Promise<SentenceBaseline> {
  return baselineSchema.parse(
    JSON.parse(await readFile(sentenceBaselinePath(root), "utf8")),
  );
}
