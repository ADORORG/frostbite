import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript, checkGameHtml } from "@ador/game-sdk/build";
import type { HostedGame } from "@ador/game-sdk/host";

import { createMemoryGameBackend } from "./memory-game-backend.ts";
import { runGameInSimulatedHost } from "./simulated-game-host.ts";

// How long a game is given to start and make its opening calls before it is judged.
export const defaultSettleMs = 150;

// Runs one game folder the way the platform will: its page is checked, its script bundled, and it is started in
// a simulated host with no storage and no network. Returns what is wrong, in words for the game's author; an
// empty list means it conforms. A game conforms when it
//   - has a page the isolated frame can serve (`checkGameHtml`) and a script that bundles;
//   - tells the platform it is ready;
//   - is never refused by the platform for what it asks (an unknown milestone, a call too large or too fast);
//   - throws nothing nobody caught.
// It is the same check for every game, so it is run over every registered game rather than left to each one.
export async function checkGameConformance(options: {
  readonly folder: string;
  readonly game: HostedGame;
  readonly settleMs?: number;
}): Promise<readonly string[]> {
  const problems: string[] = [];
  const html = await readFile(join(options.folder, "index.html"), "utf8").catch(
    () => null,
  );
  if (html === null) return ["The game has no index.html."];
  problems.push(...checkGameHtml(html));
  let script: string;
  try {
    script = await bundleGameScript(join(options.folder, "src/main.ts"));
  } catch (error) {
    return [
      ...problems,
      `The script does not bundle: ${error instanceof Error ? error.message : "unknown error"}`,
    ];
  }
  const running = runGameInSimulatedHost({
    backend: createMemoryGameBackend().backend,
    game: options.game,
    html,
    script,
  });
  const uncaught: string[] = [];
  running.window.addEventListener("error", (event) => {
    uncaught.push(event.message);
  });
  await new Promise((resolve) =>
    setTimeout(resolve, options.settleMs ?? defaultSettleMs),
  );
  try {
    if (!running.events.some(({ type }) => type === "ready"))
      problems.push("The game never told the platform it was ready.");
    for (const event of running.events)
      if (event.type === "refused")
        problems.push(
          `The platform refused "${event.method}" (${event.code}).`,
        );
    for (const message of uncaught)
      problems.push(`The game threw an error nobody caught: ${message}`);
  } finally {
    running.close();
  }
  return problems;
}
