import type { GameVerifier, RunRecord } from "./run-record.ts";

// What replaying a record with a game's rules gives: what the run earned, or the first reason it is not a legal run. The
// same code runs inside a game's verifier artifact (on the platform's server) and in a game's own tests.
export type ReplayOutcome =
  | { readonly earned: readonly string[]; readonly ok: true }
  | {
      readonly detail: string;
      readonly index: number | null;
      readonly ok: false;
      readonly reason: "illegal-input" | "invalid-config" | "verifier-error";
    };

// Plays a record's inputs through the rules, in order, from its seed and settings. Never throws: a refused input, refused
// settings and a failure inside the rules are each an outcome, so a verdict is always one of them.
export function replayRecord<State>(
  rules: GameVerifier<State>,
  record: RunRecord,
): ReplayOutcome {
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
    // A bug in the rules must not take a server down or be read as a verdict on the run.
    return {
      detail: "The verifier failed while replaying this run.",
      index: null,
      ok: false,
      reason: "verifier-error",
    };
  }
}

// The names a verifier artifact leaves in its global scope for the platform's runner to find. The artifact is one script
// that, once run, defines these and nothing else the runner relies on.
export const replayGlobal = "__frostbiteReplay";
export const sampleGlobal = "__frostbiteSample";
export const metaGlobal = "__frostbiteMeta";

// The whole surface the platform uses: a record as text in, an outcome as text out, so the same artifact can run in the
// server's process or in an isolated runtime that only passes strings across. The record has been checked against the
// schema by the platform before it gets here; the rules still refuse anything they do not accept.
export function replayFromText<State>(
  rules: GameVerifier<State>,
  text: string,
): string {
  let record: RunRecord;
  try {
    record = JSON.parse(text) as RunRecord;
  } catch {
    return JSON.stringify({
      detail: "The record is not valid JSON.",
      index: null,
      ok: false,
      reason: "verifier-error",
    } satisfies ReplayOutcome);
  }
  return JSON.stringify(replayRecord(rules, record));
}

// What a game's replay module calls to publish its rules as a verifier artifact: the replay function, one legal sample run
// (for the platform's conformance checks) and the rules' id and version.
export function exposeReplay<State>(
  rules: GameVerifier<State>,
  sample: RunRecord,
): void {
  Reflect.set(globalThis, replayGlobal, (text: string) =>
    replayFromText(rules, text),
  );
  Reflect.set(globalThis, sampleGlobal, JSON.stringify(sample));
  Reflect.set(
    globalThis,
    metaGlobal,
    JSON.stringify({ id: rules.id, version: rules.version }),
  );
}
