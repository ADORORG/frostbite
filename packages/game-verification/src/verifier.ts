import { replayRecord, type ReplayOutcome } from "@frostbite/game-sdk/replay";
import type { GameVerifier, RunRecord } from "@frostbite/game-sdk/run-record";

export type { GameVerifier, Stepped } from "@frostbite/game-sdk/run-record";
export type { ReplayOutcome } from "@frostbite/game-sdk/replay";

// A verifier with its state type folded away, so verifiers of different games sit in one registry.
export interface Verifier {
  readonly id: string;
  readonly version: number;
  replay(record: RunRecord): ReplayOutcome;
}

// Rules in this process, as a verifier. The replay is the SDK's, the one a game's published artifact runs, so a game's own
// tests and the platform replay a record the same way.
export function defineVerifier<State>(rules: GameVerifier<State>): Verifier {
  return {
    id: rules.id,
    replay: (record) => replayRecord(rules, record),
    version: rules.version,
  };
}
