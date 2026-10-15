import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadGameVerifiers } from "@ador/game-verification/loader";
import { resolveVerificationPolicy } from "@ador/game-verification/policy";
import { createInProcessRunner } from "@ador/game-verification/runner";
import type { GameManifest } from "@ador/shared/games";

// The platform's replay verifiers, built from the games' own manifests and built artifacts: nothing here names a game. A
// game the platform plays itself (`embedded`, built from this repository and reviewed) is first-party and replayed by the
// in-process runner; any other game's verifier would need a sandboxed runner, which does not exist yet, so such a game stays
// self-reported. Games that publish no verifier are ignored.
export async function createGameVerifiers(options: {
  readonly games: readonly Readonly<GameManifest>[];
  // Where the built games are served from: one folder per game id, holding its `verifier.js`.
  readonly playRoot: string;
}) {
  const policy = resolveVerificationPolicy();
  return loadGameVerifiers({
    firstParty: new Set(
      options.games
        .filter(({ launch }) => launch.mode === "embedded")
        .map(({ id }) => id),
    ),
    games: options.games,
    readArtifact: (gameId) =>
      readFile(join(options.playRoot, gameId, "verifier.js"), "utf8").then(
        (code) => code,
        () => null,
      ),
    runners: {
      firstParty: createInProcessRunner({
        replayTimeoutMs: policy.replayTimeoutMs,
      }),
    },
  });
}
