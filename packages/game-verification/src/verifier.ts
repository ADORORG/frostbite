import type { JsonValue } from "@ador/game-sdk/protocol";
import type { RunInput, RunRecord } from "@ador/game-sdk/run-record";

// A game's rules, as a pure state machine the platform can run on its own server. It owns its seeded generator and
// nothing else: no clock, no `Math.random`, no network, no storage, and the same seed and inputs always give the same
// end state. It refuses an input that is not legal in the state it is in; it never throws for one.
export type Stepped<State> =
  | { readonly ok: true; readonly state: State }
  | { readonly ok: false; readonly reason: string };

export interface GameVerifier<State> {
  // The milestones the run has earned in this state (the ones the game's own rules say are reached).
  earned(state: State): readonly string[];
  // What a record names to be replayed by these rules.
  readonly id: string;
  // Starts a run. Refuses settings the game does not allow (a mine count out of range, say).
  init(
    seed: number,
    config: Readonly<Record<string, JsonValue>>,
  ): Stepped<State>;
  step(state: State, input: RunInput): Stepped<State>;
  // The version of these rules; a record made under another version is not replayed.
  readonly version: number;
}

export type ReplayOutcome =
  | { readonly earned: readonly string[]; readonly ok: true }
  | {
      readonly detail: string;
      readonly index: number | null;
      readonly ok: false;
      readonly reason: "illegal-input" | "invalid-config" | "verifier-error";
    };

// A verifier with its state type folded away, so verifiers of different games sit in one registry.
export interface Verifier {
  readonly id: string;
  readonly version: number;
  replay(record: RunRecord): ReplayOutcome;
}

export function defineVerifier<State>(rules: GameVerifier<State>): Verifier {
  return {
    id: rules.id,
    replay(record) {
      try {
        const started = rules.init(record.seed, record.config);
        if (!started.ok)
          return {
            detail: started.reason,
            index: null,
            ok: false,
            reason: "invalid-config",
          };
        let state = started.state;
        for (const [index, input] of record.inputs.entries()) {
          const next = rules.step(state, input);
          if (!next.ok)
            return {
              detail: next.reason,
              index,
              ok: false,
              reason: "illegal-input",
            };
          state = next.state;
        }
        return { earned: [...new Set(rules.earned(state))], ok: true };
      } catch {
        // A verifier is platform code, but a bug in it must not take the server down or be read as a verdict on the run.
        return {
          detail: "The verifier failed while replaying this run.",
          index: null,
          ok: false,
          reason: "verifier-error",
        };
      }
    },
    version: rules.version,
  };
}
