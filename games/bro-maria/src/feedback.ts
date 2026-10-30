import { jumpSpeed } from "./rules/constants.ts";
import type { EffectName } from "./audio.ts";
import type { State } from "./rules/types.ts";
import { coinsTaken } from "./rules/milestones.ts";

// The sounds that go with what changed between two ticks of a run, in the order they would be heard.
export function worldSounds(
  before: State,
  after: State,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  const stomped = after.stomps > before.stomps;
  const jumped =
    (before.hero.grounded || before.hero.coyote > 0) &&
    after.hero.vy <= -jumpSpeed + 8 &&
    !stomped;
  if (jumped) heard.push("jump");
  if (coinsTaken(after) > coinsTaken(before)) heard.push("coin");
  if (stomped) heard.push("stomp");
  if (after.crates > before.crates) heard.push("bump");
  if (after.deaths > before.deaths) heard.push("die");
  else if (after.hits > before.hits) heard.push("hit");
  if (after.checkpoint && !before.checkpoint) heard.push("checkpoint");
  if (after.finishTick !== null && before.finishTick === null)
    heard.push("finish");
  return heard;
}
