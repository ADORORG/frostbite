import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bundleVerifier } from "@ador/game-sdk/build";

// A made-up game, "tally", that the platform has never heard of: add 1 to 3 to a tally until it reaches the target. It is
// built through the same path every game's rules take (src/replay.ts -> verifier.js), and nothing in the platform names it.
// An input called "spin" never returns, to show what a game's own bug can do to a server.
export const tallySource = `
import type { GameVerifier } from "@ador/game-sdk/run-record";
const rules: GameVerifier<{ count: number; target: number }> = {
  earned: ({ count, target }) => (count >= target ? ["reached"] : []),
  id: "tally",
  init: (_seed, config) =>
    typeof config.target === "number" && config.target >= 1
      ? { ok: true, state: { count: 0, target: config.target } }
      : { ok: false, reason: "a target is needed" },
  step: (state, input) => {
    if (input.type === "spin") for (;;) { /* never returns */ }
    return input.type === "add" && typeof input.data === "number" && input.data >= 1 && input.data <= 3
      ? { ok: true, state: { ...state, count: state.count + input.data } }
      : { ok: false, reason: "add takes 1, 2 or 3" };
  },
  version: 2,
};
export default rules;
export function sample() {
  return {
    claims: ["reached"],
    config: { target: 3 },
    gameId: "tally-game",
    inputs: [{ data: 3, type: "add" }],
    schemaVersion: 1 as const,
    seed: 11,
    verifier: "tally",
    verifierVersion: 2,
  };
}
`;

export async function buildArtifact(source = tallySource) {
  const directory = await mkdtemp(join(tmpdir(), "tally-game-"));
  try {
    await mkdir(join(directory, "src"));
    await writeFile(join(directory, "src", "replay.ts"), source);
    const built = await bundleVerifier(directory);
    if (built === null) throw new Error("No artifact");
    return built;
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

// A script that publishes what an artifact must, written by hand, for the cases a build would not produce.
export const handWritten = (replay: string, sample: string, meta: string) =>
  `globalThis.__adorReplay = ${replay}; globalThis.__adorSample = ${JSON.stringify(sample)}; globalThis.__adorMeta = ${JSON.stringify(meta)};`;
