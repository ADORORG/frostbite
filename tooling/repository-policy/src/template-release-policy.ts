import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

// What contracts/templates/release.json says about each released template, and the released files the repository carries beside it.
// A template's code hash must not change without a new template version, and building the same source in another environment gives
// different bytes (the C compiler and the system around it leave their mark), so the released bytes themselves are kept in the
// repository and everything that ships them (the container image) copies these files instead of rebuilding them.
export const releaseDirectory = "contracts/templates";
const releaseSchema = z.record(
  z.string(),
  z.object({ bytes: z.number().int(), sha256: z.string() }).strict(),
);

const sha256 = (content: Uint8Array) =>
  createHash("sha256").update(content).digest("hex");

export async function findTemplateReleaseViolations(
  root: string,
): Promise<string[]> {
  const directory = join(root, releaseDirectory);
  const release = releaseSchema.parse(
    JSON.parse(await readFile(join(directory, "release.json"), "utf8")),
  );
  const violations: string[] = [];
  const kept = (
    await readdir(join(directory, "released")).catch((): string[] => [])
  ).sort();
  for (const [crate, expected] of Object.entries(release)) {
    const name = `${crate}.wasm`;
    const path = `${releaseDirectory}/released/${name}`;
    if (!kept.includes(name)) {
      violations.push(`${path} is missing: release.json lists ${crate}.`);
      continue;
    }
    const content = await readFile(join(directory, "released", name));
    if (
      content.length !== expected.bytes ||
      sha256(content) !== expected.sha256
    )
      violations.push(
        `${path} does not match the bytes and hash in release.json.`,
      );
  }
  for (const name of kept)
    if (!(name.replace(/\.wasm$/u, "") in release) || !name.endsWith(".wasm"))
      violations.push(
        `${releaseDirectory}/released/${name} is not a template release.json lists.`,
      );
  return violations;
}
