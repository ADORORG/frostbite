import type { EffectName } from "./audio.ts";
import type { MatchState } from "./rules/state.ts";

// The sounds that go with what changed between two states, in the order they would be heard. A match rings higher the longer its chain ran.
export function swapSounds(
  before: MatchState,
  after: MatchState,
): readonly EffectName[] {
  const heard: EffectName[] = [
    `match${String(Math.min(4, Math.max(0, after.lastDepth - 1)))}` as EffectName,
  ];
  if (after.bombsFired > before.bombsFired) heard.push("blast");
  if (after.bombsMade + after.starsMade > before.bombsMade + before.starsMade)
    heard.push("special");
  if (after.reshuffles > before.reshuffles) heard.push("shuffle");
  if (after.level > before.level) heard.push("level");
  if (after.ended) heard.push("lose");
  return heard;
}

// What the screen says of the swap just made: how long the chain ran, if it ran, and what the swap scored.
export const toastFor = (state: MatchState): string =>
  state.lastDepth >= 2
    ? `CHAIN x${String(state.lastDepth)}  +${String(state.lastGain)}`
    : `+${String(state.lastGain)}`;

// How much faster the music goes as the swaps run low: up to half again as fast.
export const tempoFor = (moves: number): number =>
  moves >= 6 ? 1 : Math.min(1.5, 1 + (6 - moves) / 12);
