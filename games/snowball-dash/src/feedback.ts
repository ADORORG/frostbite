import type { EffectName } from "./audio.ts";
import type { SnowballState } from "./rules/types.ts";

// The sounds that go with what changed between two states of a run. The player's own hop is sounded where it is made and the crash
// where the run ends; this is for what the slope did: the snowball coming down onto the snow.
export function worldSounds(
  before: SnowballState,
  after: SnowballState,
): readonly EffectName[] {
  return before.air !== 0 && after.air === 0 && after.alive ? ["landed"] : [];
}
