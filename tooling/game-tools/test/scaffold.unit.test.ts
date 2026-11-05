import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  exportNameOf,
  ScaffoldError,
  scaffoldGame,
  titleOf,
  type ScaffoldPaths,
} from "../src/scaffold.ts";

// A template small enough to read at a glance: one game folder, its manifest, and a registry with the two anchors.
let root = "";
let paths: ScaffoldPaths;
const registryText = `import { starterGame } from "./games/starter.ts";
// game:new adds imports above this line.

export const games = [
  starterGame,
  // game:new adds games above this line.
];
`;
const manifestText = `import { defineGame } from "@frostbite/shared/games";

// Starter Game, the template. Its comment is about the template.
export const starterGame = defineGame({ id: "starter-game", title: "Starter Game" });
`;
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );
const read = (...parts: string[]) => readFile(join(root, ...parts), "utf8");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "scaffold-"));
  paths = {
    gamesDirectory: join(root, "games"),
    manifestDirectory: join(root, "configs/games"),
    registryFile: join(root, "configs/games.ts"),
    templateDirectory: join(root, "games/starter-game"),
    templateManifestFile: join(root, "configs/games/starter.ts"),
  };
  await mkdir(join(paths.templateDirectory, "src"), { recursive: true });
  await mkdir(join(paths.templateDirectory, "node_modules/dep"), {
    recursive: true,
  });
  await mkdir(join(paths.templateDirectory, "dist"), { recursive: true });
  await mkdir(paths.manifestDirectory, { recursive: true });
  await writeFile(
    join(paths.templateDirectory, "src/game.ts"),
    'export const name = "starter-game"; // Starter Game, starterGame, starter-game\n',
  );
  await writeFile(join(paths.templateDirectory, "logo.png"), "starter-game");
  await writeFile(join(paths.templateDirectory, "node_modules/dep/x.ts"), "x");
  await writeFile(join(paths.templateDirectory, "dist/out.js"), "x");
  await writeFile(paths.templateManifestFile, manifestText);
  await writeFile(paths.registryFile, registryText);
});
afterEach(() => rm(root, { force: true, recursive: true }));

const failure = (id: string, title?: string) =>
  scaffoldGame({ id, paths, ...(title === undefined ? {} : { title }) }).then(
    () => null,
    (error: unknown) => error,
  );

describe("names", () => {
  it("turns an id into the manifest's export name and a default title", () => {
    expect(exportNameOf("my-game")).toBe("myGameGame");
    expect(exportNameOf("tap-2-win")).toBe("tap2WinGame");
    expect(exportNameOf("solo")).toBe("soloGame");
    expect(titleOf("my-game")).toBe("My Game");
    expect(titleOf("solo")).toBe("Solo");
  });
});

describe("refusing before writing anything", () => {
  it.each(["My Game", "a", "-bad-", "x".repeat(65), ""])(
    "refuses %j as an id",
    async (id) => {
      expect(await failure(id)).toBeInstanceOf(ScaffoldError);
      expect(await readdir(paths.gamesDirectory)).toEqual(["starter-game"]);
    },
  );

  it("refuses the template's own id", async () => {
    expect(await failure("starter-game")).toMatchObject({
      message: '"starter-game" is the template itself.',
    });
  });

  it.each(["", "   ", "x".repeat(200)])(
    "refuses %j as a title",
    async (title) => {
      expect(await failure("new-game", title)).toBeInstanceOf(ScaffoldError);
      expect(await exists(join(paths.gamesDirectory, "new-game"))).toBe(false);
    },
  );

  it("refuses a game whose folder or manifest already exists, and changes nothing", async () => {
    await mkdir(join(paths.gamesDirectory, "taken"));
    expect(await failure("taken")).toMatchObject({
      message: expect.stringContaining("already exists; nothing was changed."),
    });
    await writeFile(join(paths.manifestDirectory, "other.ts"), "x");
    expect(await failure("other")).toBeInstanceOf(ScaffoldError);
    expect(await read("configs/games.ts")).toBe(registryText);
  });

  it.each([
    ["the import anchor", "// game:new adds imports above this line."],
    ["the game anchor", "// game:new adds games above this line."],
  ])("refuses a registry without %s", async (_name, anchor) => {
    await writeFile(paths.registryFile, registryText.replace(anchor, ""));
    expect(await failure("new-game")).toMatchObject({
      message: expect.stringContaining(anchor),
    });
    expect(await exists(join(paths.gamesDirectory, "new-game"))).toBe(false);
  });

  it("refuses a game whose export name is already registered", async () => {
    await writeFile(
      paths.registryFile,
      registryText.replace("starterGame,", "newGameGame,"),
    );
    expect(await failure("new-game")).toMatchObject({
      message: "A game named newGameGame is already registered.",
    });
    await writeFile(
      paths.registryFile,
      registryText.replace("{ starterGame }", "{ newGameGame }"),
    );
    expect(await failure("new-game")).toBeInstanceOf(ScaffoldError);
  });
});

describe("making a game", () => {
  it("copies the template, renames what it carries, and leaves out what a build leaves behind", async () => {
    const { created } = await scaffoldGame({ id: "new-game", paths });
    const folder = join(paths.gamesDirectory, "new-game");
    expect(created).toEqual([
      folder,
      join(paths.manifestDirectory, "new-game.ts"),
    ]);
    expect(await read("games/new-game/src/game.ts")).toBe(
      'export const name = "new-game"; // New Game, newGameGame, new-game\n',
    );
    expect(await exists(join(folder, "node_modules"))).toBe(false);
    expect(await exists(join(folder, "dist"))).toBe(false);
    // Files that are not text are copied as they are.
    expect(await read("games/new-game/logo.png")).toBe("starter-game");
    // The template itself is untouched.
    expect(await read("games/starter-game/src/game.ts")).toContain(
      "starter-game",
    );
  });

  it("writes a README that names the game and where its pieces are", async () => {
    await scaffoldGame({ id: "new-game", paths, title: "  Brand New  " });
    const readme = await read("games/new-game/README.md");
    expect(readme).toContain("# Brand New");
    expect(readme).toContain("configs/games/new-game.ts");
    expect(readme).toContain("pnpm --filter @game/new-game test:unit");
  });

  it("writes the manifest with a comment of its own, not the template's", async () => {
    await scaffoldGame({ id: "new-game", paths, title: "Brand New" });
    const manifest = await read("configs/games/new-game.ts");
    expect(manifest).toContain("// Brand New, started from the template.");
    expect(manifest).not.toContain("Its comment is about the template");
    expect(manifest).toContain(
      'export const newGameGame = defineGame({ id: "new-game", title: "Brand New" });',
    );
    expect(
      manifest.startsWith(
        'import { defineGame } from "@frostbite/shared/games";',
      ),
    ).toBe(true);
  });

  it("registers the game on the two lines the anchors mark and keeps the anchors", async () => {
    await scaffoldGame({ id: "new-game", paths });
    const registry = await read("configs/games.ts");
    expect(registry).toContain(
      'import { newGameGame } from "./games/new-game.ts";\n// game:new adds imports above this line.',
    );
    expect(registry).toContain(
      "newGameGame,\n  // game:new adds games above this line.",
    );
    expect(registry).toContain("  starterGame,\n  newGameGame,");
  });

  it("makes a second game after the first, and refuses the first again", async () => {
    await scaffoldGame({ id: "one", paths });
    await scaffoldGame({ id: "two", paths });
    const registry = await read("configs/games.ts");
    expect(registry.indexOf("oneGame,")).toBeLessThan(
      registry.indexOf("twoGame,"),
    );
    expect(await failure("one")).toBeInstanceOf(ScaffoldError);
  });
});
