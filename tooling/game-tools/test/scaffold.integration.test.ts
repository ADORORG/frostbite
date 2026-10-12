import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { gameManifestSchema } from "@ador/shared/games";
import { checkGameConformance } from "@ador/test-kit/game-conformance";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  exportNameOf,
  ScaffoldError,
  scaffoldGame,
  titleOf,
} from "../src/scaffold.ts";

const repository = join(import.meta.dirname, "../../..");
const skipped = new Set(["node_modules", "coverage", ".turbo"]);
let workspace = "";
const paths = () => ({
  gamesDirectory: join(workspace, "games"),
  manifestDirectory: join(workspace, "configs/games"),
  registryFile: join(workspace, "configs/games.ts"),
  templateDirectory: join(workspace, "games/sample-game"),
  templateManifestFile: join(workspace, "configs/games/sample.ts"),
});

// A copy of the parts of the repository a new game touches, inside this package so the game's imports resolve.
beforeEach(async () => {
  workspace = await mkdtemp(join(import.meta.dirname, "..", ".tmp-"));
  await cp(
    join(repository, "games/sample-game"),
    join(workspace, "games/sample-game"),
    {
      filter: (source) => !skipped.has(source.split("/").pop() ?? ""),
      recursive: true,
    },
  );
  await mkdir(join(workspace, "games/sample-game/coverage"));
  await writeFile(join(workspace, "games/sample-game/coverage/x.json"), "{}");
  await mkdir(join(workspace, "configs/games"), { recursive: true });
  for (const file of ["games.ts", "chains.ts", "games/sample.ts"])
    await cp(
      join(repository, "configs", file),
      join(workspace, "configs", file),
    );
});
afterEach(() => rm(workspace, { force: true, recursive: true }));

const read = (path: string) => readFile(join(workspace, path), "utf8");
const exists = (path: string) =>
  stat(join(workspace, path)).then(
    () => true,
    () => false,
  );

describe("making a new game from the template", () => {
  it("copies the template under the new name, without what a build leaves behind", async () => {
    await scaffoldGame({ id: "river-run", paths: paths(), title: "River Run" });
    const folder = (await readdir(join(workspace, "games/river-run"))).sort();
    expect(folder).toEqual(
      expect.arrayContaining([
        "index.html",
        "package.json",
        "src",
        "styles.css",
        "test",
      ]),
    );
    expect(folder).not.toContain("coverage");
    expect(JSON.parse(await read("games/river-run/package.json")).name).toBe(
      "@game/river-run",
    );
    expect(await read("games/river-run/index.html")).toContain(
      "<title>River Run</title>",
    );
    expect(await read("games/river-run/README.md")).toContain("# River Run");
    expect(await read("games/river-run/README.md")).not.toContain("Tap Tower");
  });

  it("writes a manifest that passes the platform's checks, and a game that conforms to the interface", async () => {
    await scaffoldGame({ id: "river-run", paths: paths(), title: "River Run" });
    const module = (await import(
      join(workspace, "configs/games/river-run.ts")
    )) as {
      riverRunGame: unknown;
    };
    const manifest = gameManifestSchema.parse(module.riverRunGame);
    expect(manifest).toMatchObject({
      id: "river-run",
      launch: { mode: "embedded" },
      title: "River Run",
    });
    expect(
      await checkGameConformance({
        folder: join(workspace, "games/river-run"),
        game: manifest,
      }),
    ).toEqual([]);
    const text = await read("configs/games/river-run.ts");
    expect(text).not.toContain("sample");
    expect(text).toContain("started from the template");
  });

  it("registers the game once, above the markers, and keeps the markers for the next one", async () => {
    await scaffoldGame({ id: "river-run", paths: paths() });
    await scaffoldGame({ id: "sky-fall", paths: paths(), title: "Sky Fall" });
    const registry = await read("configs/games.ts");
    for (const name of ["riverRunGame", "skyFallGame"]) {
      expect(
        registry.match(new RegExp(`import \\{ ${name} \\}`, "gu")),
      ).toHaveLength(1);
      expect(registry.match(new RegExp(`^\\s+${name},$`, "gmu"))).toHaveLength(
        1,
      );
    }
    expect(registry.indexOf("riverRunGame,")).toBeLessThan(
      registry.indexOf("// game:new adds games above this line."),
    );
    expect(registry.indexOf('from "./games/sky-fall.ts"')).toBeLessThan(
      registry.indexOf("// game:new adds imports above this line."),
    );
    expect(await read("configs/games/river-run.ts")).toContain(
      'title: "River Run"',
    );
  });

  it("uses a title made from the id when none is given", async () => {
    await scaffoldGame({ id: "river-run", paths: paths() });
    expect(await read("configs/games/river-run.ts")).toContain(
      'title: "River Run"',
    );
  });

  describe("refuses, and changes nothing, when", () => {
    const untouched = async (id: string) => {
      expect(await exists(`games/${id}`)).toBe(false);
      expect(await exists(`configs/games/${id}.ts`)).toBe(false);
    };

    it.each([
      ["the id is not a slug", "River Run", /not a game id/u],
      ["the id has path parts", "../x", /not a game id/u],
      ["the id is too short", "a", /not a game id/u],
      ["the id is the template's", "sample-game", /template itself/u],
    ])("%s", async (_name, id, message) => {
      const before = await read("configs/games.ts");
      await expect(scaffoldGame({ id, paths: paths() })).rejects.toThrow(
        message,
      );
      expect(await read("configs/games.ts")).toBe(before);
    });

    it("the title is empty or too long", async () => {
      for (const title of ["   ", "x".repeat(81)])
        await expect(
          scaffoldGame({ id: "river-run", paths: paths(), title }),
        ).rejects.toThrow(/title must be/u);
      await untouched("river-run");
    });

    it("the game already exists", async () => {
      await scaffoldGame({ id: "river-run", paths: paths() });
      const before = await read("configs/games.ts");
      await expect(
        scaffoldGame({ id: "river-run", paths: paths() }),
      ).rejects.toThrow(ScaffoldError);
      expect(await read("configs/games.ts")).toBe(before);
    });

    it("only the manifest already exists", async () => {
      await writeFile(join(workspace, "configs/games/river-run.ts"), "// mine");
      await expect(
        scaffoldGame({ id: "river-run", paths: paths() }),
      ).rejects.toThrow(/already exists/u);
      expect(await exists("games/river-run")).toBe(false);
    });

    it("the registry has lost a marker", async () => {
      const registry = (await read("configs/games.ts")).replace(
        "// game:new adds games above this line.",
        "",
      );
      await writeFile(join(workspace, "configs/games.ts"), registry);
      await expect(
        scaffoldGame({ id: "river-run", paths: paths() }),
      ).rejects.toThrow(/has no line/u);
      await untouched("river-run");
    });

    it("another game already has the same export name", async () => {
      await scaffoldGame({ id: "river-run", paths: paths() });
      await rm(join(workspace, "games/river-run"), { recursive: true });
      await rm(join(workspace, "configs/games/river-run.ts"));
      await expect(
        scaffoldGame({ id: "river-run", paths: paths() }),
      ).rejects.toThrow(/already registered/u);
    });
  });
});

describe("the names made from an id", () => {
  it("builds the export and the title from the words of the id", () => {
    expect(exportNameOf("river-run")).toBe("riverRunGame");
    expect(exportNameOf("go")).toBe("goGame");
    expect(exportNameOf("level-2-game")).toBe("level2GameGame");
    expect(titleOf("river-run")).toBe("River Run");
    expect(titleOf("go")).toBe("Go");
  });
});
