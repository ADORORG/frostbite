import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { listConfigModules } from "../src/modules.ts";

const scratch = mkdtempSync(join(tmpdir(), "configs-"));
afterAll(() => rmSync(scratch, { force: true, recursive: true }));

describe("the configuration modules", () => {
  it("are the .ts files of the directory and of games/, without extension, in order", () => {
    mkdirSync(join(scratch, "games"));
    mkdirSync(join(scratch, "src"));
    for (const file of [
      "b.ts",
      "a.ts",
      "notes.md",
      "games/x.ts",
      "games/y.json",
    ])
      writeFileSync(join(scratch, file), "");
    expect(listConfigModules(scratch)).toEqual(["a", "b", "games/x"]);
  });
});
