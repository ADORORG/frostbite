import type { EffectName } from "./audio.ts";
import type { RunnerState } from "./rules/types.ts";

// The sounds that go with what changed between two states of a run. The player's own jump and slide are sounded where they are made;
// this is for what the world did.
export function worldSounds(
  before: RunnerState,
  after: RunnerState,
): readonly EffectName[] {
  return after.shardsTaken > before.shardsTaken ? ["shard"] : [];
}
