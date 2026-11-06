import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { notPlayedOnAScreen, playerGames } from "../src/player-games.ts";

let directory = "";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "player-games-"));
});
afterEach(() => rm(directory, { force: true, recursive: true }));

describe("the games every check runs over", () => {
  it("lists each folder of games, in order, but not the games that are not played on a screen of their own", async () => {
    for (const name of ["zebra", "apple", ...notPlayedOnAScreen])
      await mkdir(join(directory, name));
    await writeFile(join(directory, "README.md"), "not a game");
    expect(await playerGames(directory)).toEqual(["apple", "zebra"]);
  });

  it("finds games in the real folder, so a new game is covered by being added", async () => {
    const games = await playerGames();
    expect(games.length).toBeGreaterThan(3);
    for (const name of notPlayedOnAScreen) expect(games).not.toContain(name);
  });
});
