import type { EffectName } from "./audio.ts";
import { levelAt } from "./rules/course.ts";
import type { RunState } from "./rules/types.ts";

// The sounds that go with what changed between two states of a run, in the order they would be heard. A shard rings higher the longer the
// run of close calls it was taken in.
export function worldSounds(
  before: RunState,
  after: RunState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  if (after.hops > before.hops) heard.push("hop");
  if (before.air > 0 && after.air === 0 && after.alive) heard.push("land");
  if (after.closeCalls > before.closeCalls) heard.push("near");
  if (after.shardsTaken > before.shardsTaken)
    heard.push(`shard${String(Math.min(4, after.streak))}` as EffectName);
  if (levelAt(after.distance) > levelAt(before.distance)) heard.push("level");
  if (before.alive && !after.alive)
    heard.push(after.cause === "fell" ? "fall" : "die");
  return heard;
}

// How much faster the music plays on a level: a little more each level, up to half again as fast.
export const tempoAt = (level: number): number =>
  Math.min(1.5, 1 + level * 0.03);
