import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { listConfigModules } from "../src/modules.ts";

const directory = fileURLToPath(new URL("..", import.meta.url));

describe("@repo/configs", () => {
  const modules = listConfigModules(directory);

  it("has the modules the platform is composed from", () => {
    for (const name of ["platform", "games", "features", "games/frostbite"])
      expect(modules).toContain(name);
  });

  it.each(modules)(
    "resolves @repo/configs/%s to its own file, so no consumer needs a relative path",
    (name) => {
      const resolved = import.meta.resolve(`@repo/configs/${name}`);
      expect(fileURLToPath(resolved)).toBe(`${directory}${name}.ts`);
    },
  );
});
