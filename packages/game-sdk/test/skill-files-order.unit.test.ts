import type { Dirent } from "node:fs";

import { describe, expect, it, vi } from "vitest";

// A directory listing comes back in whatever order the operating system keeps; the list the install writes into its record must not.
const entry = (name: string, directory = false) =>
  ({
    isDirectory: () => directory,
    isFile: () => !directory,
    name,
  }) as unknown as Dirent;

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn((path: string) =>
    Promise.resolve(
      path.endsWith("/sub")
        ? [entry("z.md"), entry("b.md")]
        : [entry("sub", true), entry("references"), entry("SKILL.md")],
    ),
  ),
}));

describe("listing a skill's files", () => {
  it("returns them in code-unit order whatever order the system listed them in, folders included", async () => {
    const { listFiles } = await import("../src/skill/files.ts");
    expect(await listFiles("/skill")).toEqual([
      "SKILL.md",
      "references",
      "sub/b.md",
      "sub/z.md",
    ]);
  });
});
