import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

// The games a person plays on a screen of their own, which every check made of "all games" runs over. A game joins by having a folder
// under `games/` (the platform's own test fails if a folder is not registered), so a new game gets these checks with no edit here.
export const gamesDirectory = resolve(import.meta.dirname, "../../../games");
// Not played on a screen of their own: the developer tool that calls every SDK method, and the fixture game, a plain starter page that
// exists so that tests have "a game" (it is not made to fit a phone, and a change to make it so would change every test that uses it).
export const notPlayedOnAScreen: ReadonlySet<string> = new Set([
  "fixture-taps",
  "sdk-explorer",
]);

export async function playerGames(
  directory: string = gamesDirectory,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isDirectory() && !notPlayedOnAScreen.has(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
}
