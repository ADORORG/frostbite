import { startDevHost } from "@ador/game-sdk/dev-host";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { devGameOf } from "./dev-games.ts";

// `pnpm game:dev <id> [--port 5173]`: opens the local test page for a registered game (the folder under `games/` and its manifest
// in `configs/games`). It is a development tool: the sample games are registered for it whatever the environment says.
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { port: { type: "string" } },
});
const [id] = positionals;
if (id === undefined || positionals.length > 1) {
  console.error("Usage: pnpm game:dev <id> [--port 5173]");
  process.exit(2);
}
process.env.APP_ENV ??= "local";
const root = resolve(import.meta.dirname, "../../..");
const { games } = await import(join(root, "configs/games.ts"));
try {
  const host = await startDevHost({
    directory: join(root, "games", id),
    game: devGameOf(games, id),
    port: values.port === undefined ? 5173 : Number(values.port),
  });
  console.log(`Local test host for ${id}: ${host.url}\nPress Ctrl+C to stop.`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "The test host did not start.",
  );
  process.exit(1);
}
