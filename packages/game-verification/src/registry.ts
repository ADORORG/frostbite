import type { RunRecord } from "@ador/game-sdk/run-record";

import type { Verifier } from "./verifier.ts";

export interface RegisteredVerifier {
  // The game this verifier belongs to. A game has one replay verifier, so the game is the key: two games may name their
  // rules alike without either being mistaken for the other.
  readonly gameId: string;
  // One legal run of the game that earns something, supplied with the verifier. Conformance replays it and mutates it,
  // so a verifier cannot be registered without a run that shows what it accepts.
  readonly sample: RunRecord;
  readonly verifier: Verifier;
}

// The verifiers the platform replays runs with, by game. Registration is explicit (built from games' manifests and their
// pinned artifacts), never discovered at run time, and a game is registered once.
export function createVerifierRegistry(entries: readonly RegisteredVerifier[]) {
  const byGame = new Map<string, RegisteredVerifier>();
  for (const entry of entries) {
    if (byGame.has(entry.gameId))
      throw new Error(`Game ${entry.gameId} has a verifier registered twice.`);
    byGame.set(entry.gameId, entry);
  }
  return {
    find: (gameId: string): RegisteredVerifier | undefined =>
      byGame.get(gameId),
    gameIds: (): readonly string[] => [...byGame.keys()].sort(),
  };
}

export type VerifierRegistry = ReturnType<typeof createVerifierRegistry>;
