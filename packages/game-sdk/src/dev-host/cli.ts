import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { argumentProblem } from "../arguments.ts";
import { devGameSchema } from "./config.ts";
import { startDevHost, type DevHost } from "./server.ts";

// `ador-game-dev <game-folder> [--game game.json] [--port 5173]`: opens a local test page for a game. `game.json` holds the parts of
// the game's manifest the page needs (`id`, `capabilities`, `milestones`); by default it is the file of that name in the folder.
export async function run(
  argv: readonly string[],
): Promise<{ readonly code: number; readonly host: DevHost | null }> {
  const usage =
    "Usage: ador-game-dev <game-folder> [--game game.json] [--port 5173]";
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: { game: { type: "string" }, port: { type: "string" } },
    });
  } catch (error) {
    // An option it does not know, or one given with no value: said, with how to use it, instead of a stack trace.
    console.error(argumentProblem(error, usage));
    return { code: 2, host: null };
  }
  const { positionals, values } = parsed;
  const [folder] = positionals;
  if (folder === undefined || positionals.length > 1) {
    console.error(
      "Usage: ador-game-dev <game-folder> [--game game.json] [--port 5173]",
    );
    return { code: 2, host: null };
  }
  const port = values.port === undefined ? 5173 : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    console.error(`"${String(values.port)}" is not a port.`);
    return { code: 2, host: null };
  }
  const manifest = resolve(values.game ?? `${folder}/game.json`);
  let game;
  try {
    game = devGameSchema.parse(JSON.parse(await readFile(manifest, "utf8")));
  } catch (error) {
    console.error(
      `${manifest} is not a game description: ${error instanceof Error ? error.message : "it could not be read"}`,
    );
    return { code: 1, host: null };
  }
  const host = await startDevHost({ directory: folder, game, port });
  console.log(
    `Local test host for ${game.id}: ${host.url}\nPress Ctrl+C to stop.`,
  );
  return { code: 0, host };
}
