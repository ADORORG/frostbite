import { describe, expect, it } from "vitest";

import {
  findCoverageUploadViolations,
  uploadedPaths,
} from "../src/workflow-policy.ts";
import type { Workspace } from "../src/workspaces.ts";

const root = "/repo";
const workspace = (directory: string, name = directory): Workspace => ({
  directory: `${root}/${directory}`,
  name,
  scripts: {},
});

const workflow = `
jobs:
  tests:
    steps:
      - name: Retain coverage reports
        uses: actions/upload-artifact@v7
        with:
          name: coverage-reports
          path: |
            coverage
            configs/coverage
            apps/*/coverage
            providers/*/*/coverage

      - name: Retain one
        uses: actions/upload-artifact@v7
        with:
          path: games/shard-match/coverage
      - name: Next
        run: echo done
`;

describe("uploadedPaths", () => {
  it("reads block and single-line paths and stops at the end of a block", () => {
    expect(uploadedPaths(workflow)).toEqual([
      "coverage",
      "configs/coverage",
      "apps/*/coverage",
      "providers/*/*/coverage",
      "games/shard-match/coverage",
    ]);
  });
});

describe("findCoverageUploadViolations", () => {
  it("accepts workspaces whose coverage folder an upload path lists, by name or by pattern", () => {
    const workspaces = [
      workspace("configs"),
      workspace("apps/web"),
      workspace("providers/storage/r2"),
      workspace("games/shard-match"),
    ];
    expect(findCoverageUploadViolations(root, workspaces, workflow)).toEqual(
      [],
    );
  });

  it("names a workspace no upload path lists", () => {
    const found = findCoverageUploadViolations(
      root,
      [workspace("tooling/new-tool", "@repo/new-tool"), workspace("apps/web")],
      workflow,
    );
    expect(found).toEqual([
      expect.stringContaining(
        "@repo/new-tool writes its coverage to tooling/new-tool/coverage",
      ),
    ]);
  });

  it("does not let a star match more or fewer folders than one", () => {
    const found = findCoverageUploadViolations(
      root,
      [workspace("apps/web/deep"), workspace("providers/one")],
      workflow,
    );
    expect(found).toHaveLength(2);
  });

  it("finds the gap when the line that listed the workspace is removed", () => {
    const without = workflow.replace("            configs/coverage\n", "");
    expect(
      findCoverageUploadViolations(root, [workspace("configs")], without),
    ).toHaveLength(1);
  });
});
