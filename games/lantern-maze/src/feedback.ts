import type { EffectName } from "./audio.ts";
import type { MazeState } from "./rules/state.ts";

// The sounds that go with what changed between two states, in the order they would be heard.
export function stepSounds(
  before: MazeState,
  after: MazeState,
): readonly EffectName[] {
  const heard: EffectName[] = ["step"];
  if (after.flasksTaken > before.flasksTaken) heard.push("flask");
  if (after.hasKey && !before.hasKey) heard.push("key");
  if (after.floorsCleared > before.floorsCleared) heard.push("door");
  if (after.cause === "dark") heard.push("dark");
  return heard;
}

// How much faster the music goes as the oil runs low: up to half again as fast.
export const tempoFor = (oil: number): number =>
  oil >= 40 ? 1 : Math.min(1.5, 1 + (40 - oil) / 80);
