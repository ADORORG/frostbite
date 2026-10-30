import type { EffectName } from "./audio.ts";
import { stageAt, type PulseState } from "./rules/state.ts";

// The sounds that go with what changed between two states of a run, in the order they would be heard. A tap sounds in the pitch of its lane when
// it hit, and a perfect one adds a glint; a miss or a stray tap has a sound of its own.
export function pulseSounds(
  before: PulseState,
  after: PulseState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  const { judged } = after;
  if (judged !== null && judged !== before.judged) {
    if (judged.kind === "miss" || judged.kind === "stray")
      heard.push(judged.kind);
    else {
      heard.push(`lane${String(judged.lane)}` as EffectName);
      if (judged.kind === "perfect") heard.push("glint");
    }
  }
  if (stageAt(after.tick) > stageAt(before.tick)) heard.push("stage");
  if (!before.ended && after.ended)
    heard.push(after.cause === "faded" ? "lose" : "win");
  return heard;
}

// The multiplier a combo has reached, to show.
export const multiplierOf = (combo: number): number =>
  Math.min(8, 1 + Math.floor(combo / 10));
