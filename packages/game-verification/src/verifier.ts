import type { GameVerifier, RunRecord } from "@ador/game-sdk/run-record";

export type { GameVerifier, Stepped } from "@ador/game-sdk/run-record";

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
