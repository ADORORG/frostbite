import { replayRecord } from "@frostbite/game-sdk/replay";
import type { GameVerifier, RunRecord } from "@frostbite/game-sdk/run-record";
import { expect } from "vitest";

// What every game that ranks scores must hold: the score the platform reads from a replay is the one the game shows and keeps as the
// player's best, and a run that has not ended has none. `shown` is the game's own reading of a finished state (the function its screen
// uses), so the rules and the screen cannot drift apart without this failing.
export function expectVerifiedScore<State>(
  rules: GameVerifier<State>,
  sample: RunRecord,
  shown: (state: State) => number,
): void {
  const started = rules.init(sample.seed, sample.config);
  if (!started.ok) throw new Error(started.reason);
  let state = started.state;
  for (const input of sample.inputs) {
    const next = rules.step(state, input);
    if (!next.ok) throw new Error(next.reason);
    state = next.state;
  }
  const outcome = replayRecord(rules, sample);
  expect(outcome).toMatchObject({ ok: true, score: shown(state) });
  expect(Number.isSafeInteger(shown(state))).toBe(true);
  expect(shown(state)).toBeGreaterThanOrEqual(0);
  expect(replayRecord(rules, { ...sample, inputs: [] })).toMatchObject({
    ok: true,
    score: null,
  });
}
