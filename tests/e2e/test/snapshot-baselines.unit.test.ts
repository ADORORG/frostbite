import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// A baseline picture belongs to the spec that takes it. When a spec is deleted its pictures are no use to anyone and, left in the
// folder, they read as a page that is still checked.
const specs = resolve(import.meta.dirname, "../tests");
const suffix = "-snapshots";

describe("the visual baselines", () => {
  it("each folder of pictures belongs to a spec that exists", async () => {
    const names = await readdir(specs);
    const folders = names.filter((name) => name.endsWith(suffix));
    expect(folders.length).toBeGreaterThan(0);
    const orphans = folders.filter(
      (folder) => !names.includes(folder.slice(0, -suffix.length)),
    );
    expect(orphans).toEqual([]);
  });
});
