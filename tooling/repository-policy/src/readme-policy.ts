import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Workspace } from "./workspaces.ts";

// Every workspace explains itself: a README that says what it is for and how to test it, and names who owns it (AGENTS.md asks for purpose,
// public API, dependencies, configuration, invariants, test commands and ownership). The check is for the parts that rot unseen: that the file
// exists, is not a stub, says how to test, and has an ownership section.
export const minimumReadmeLines = 12;
const ownershipHeading = /^#{2,3}\s*(operational\s+)?owner/imu;
const testing = /\btest/iu;

export async function findReadmeViolations(
  workspaces: readonly Workspace[],
): Promise<readonly string[]> {
  const violations: string[] = [];
  for (const workspace of workspaces) {
    let contents: string;
    try {
      contents = await readFile(
        resolve(workspace.directory, "README.md"),
        "utf8",
      );
    } catch {
      violations.push(`${workspace.name} has no README.md.`);
      continue;
    }
    if (contents.split("\n").length < minimumReadmeLines)
      violations.push(
        `${workspace.name}'s README.md is under ${String(minimumReadmeLines)} lines.`,
      );
    if (!testing.test(contents))
      violations.push(
        `${workspace.name}'s README.md does not say how to test it.`,
      );
    if (!ownershipHeading.test(contents))
      violations.push(
        `${workspace.name}'s README.md has no Ownership section.`,
      );
  }
  return violations;
}
