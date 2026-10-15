import type { RunRecord } from "@ador/game-sdk/run-record";

import type { Verifier } from "./verifier.ts";

export interface RegisteredVerifier {
  // The game this verifier belongs to: a record for another game is refused even if it names this verifier.
  readonly gameId: string;
  // One legal run of the game that earns something, supplied with the verifier. Conformance replays it and mutates it,
  // so a verifier cannot be registered without a run that shows what it accepts.
  readonly sample: RunRecord;
  readonly verifier: Verifier;
}

// The verifiers the platform replays runs with, by id. Registration is explicit and reviewed (configs/verifiers.ts),
// never discovered at run time, and an id is registered once.
export function createVerifierRegistry(entries: readonly RegisteredVerifier[]) {
  const byId = new Map<string, RegisteredVerifier>();
  for (const entry of entries) {
    if (byId.has(entry.verifier.id))
      throw new Error(`Verifier ${entry.verifier.id} is registered twice.`);
    byId.set(entry.verifier.id, entry);
  }
  return {
    find: (id: string): RegisteredVerifier | undefined => byId.get(id),
    ids: (): readonly string[] => [...byId.keys()].sort(),
  };
}

export type VerifierRegistry = ReturnType<typeof createVerifierRegistry>;
