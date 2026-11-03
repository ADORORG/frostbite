import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import type { Workspace } from "./workspaces.ts";

// The merged coverage check needs every workspace's report, and CI hands the reports from the test jobs to the merge job as uploaded
// artifacts: only the folders listed under `path:` of an upload step arrive. A workspace missing from the lists fails the merge job
// (`configs` did, after it became a workspace), minutes into a CI run. This check finds it before the push.
export const ciWorkflowPath = ".github/workflows/ci.yml";

// The `path:` values of every upload-artifact step: one value on the line, or a `|` block of lines.
export function uploadedPaths(workflow: string): readonly string[] {
  const lines = workflow.split("\n");
  const paths: string[] = [];
  lines.forEach((line, index) => {
    const single = /^\s*path:\s*(?!\|)(\S.*?)\s*$/.exec(line)?.[1];
    if (single !== undefined) paths.push(single);
    if (!/^\s*path:\s*\|\s*$/.test(line)) return;
    const indent = (/^\s*/.exec(line)?.[0] ?? "").length;
    for (const next of lines.slice(index + 1)) {
      const nextIndent = (/^\s*/.exec(next)?.[0] ?? "").length;
      if (next.trim() === "" || nextIndent <= indent) break;
      paths.push(next.trim());
    }
  });
  return paths;
}

// A pattern like `providers/*/*/coverage`: each `*` stands for one folder name, and nothing else is a wildcard.
function matches(pattern: string, path: string): boolean {
  const expression = pattern
    .split("/")
    .map((part) =>
      part === "*" ? "[^/]+" : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${expression}$`).test(path);
}

export function findCoverageUploadViolations(
  root: string,
  workspaces: readonly Workspace[],
  workflow: string,
): readonly string[] {
  const patterns = uploadedPaths(workflow);
  return workspaces
    .map((workspace) => ({
      folder: `${relative(root, resolve(workspace.directory)).replaceAll("\\", "/")}/coverage`,
      name: workspace.name,
    }))
    .filter(
      ({ folder }) => !patterns.some((pattern) => matches(pattern, folder)),
    )
    .map(
      ({ folder, name }) =>
        `${name} writes its coverage to ${folder}, which no upload step in ${ciWorkflowPath} lists, so the merged coverage check cannot find it.`,
    );
}

export async function readCiWorkflow(root: string): Promise<string> {
  return readFile(resolve(root, ciWorkflowPath), "utf8");
}
