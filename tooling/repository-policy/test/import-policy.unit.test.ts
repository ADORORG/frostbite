import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  allowedDeepImports,
  findDeepRelativeImports,
  hasDeepRelativeImport,
} from "../src/import-policy.ts";

// The samples are built, not written out, so this file does not itself climb three folders in a string the policy would read.
const up = (count: number) => "../".repeat(count);
const message = `imports a file through three or more "../"; use a package name or "@/".`;

describe("deep relative imports", () => {
  it.each([
    `import a from "${up(3)}x";`,
    `} from '${up(4)}y/z.ts';`,
    `const m = await import("${up(3)}configs/games");`,
    `vi.mock("${up(3)}x", () => ({}));`,
    `import "${up(3)}side-effect";`,
  ])("are found in: %s", (line) => {
    expect(hasDeepRelativeImport(line)).toBe(true);
  });

  it.each([
    `import a from "${up(2)}x";`,
    `import a from "${up(1)}x";`,
    `import a from "./x";`,
    `import a from "@repo/configs/games";`,
    `const path = "${up(3)}not-an-import";`,
  ])("are not found in: %s", (line) => {
    expect(hasDeepRelativeImport(line)).toBe(false);
  });
});

describe("the repository's files", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "imports-"));
    await mkdir(join(root, "a"), { recursive: true });
    await writeFile(join(root, "a/deep.ts"), `import x from "${up(3)}x";\n`);
    await writeFile(join(root, "a/ok.ts"), `import x from "${up(2)}x";\n`);
    await writeFile(join(root, "a/deep.css"), `@import "${up(3)}x.css";\n`);
  });
  afterAll(() => rm(root, { force: true, recursive: true }));

  it("are named when they climb three folders or more, and only scripts are read", async () => {
    const files = ["a/deep.ts", "a/ok.ts", "a/deep.css"].map((name) =>
      join(root, name),
    );
    expect(await findDeepRelativeImports(root, files)).toEqual([
      `a/deep.ts ${message}`,
    ]);
  });

  it("may keep an exception that has a reason", async () => {
    await mkdir(join(root, "apps/web/test"), { recursive: true });
    const name = "apps/web/test/rewards-policy.unit.test.ts";
    await writeFile(join(root, name), `import x from "${up(3)}x";\n`);
    expect(name in allowedDeepImports).toBe(true);
    expect(await findDeepRelativeImports(root, [join(root, name)])).toEqual([]);
  });
});
