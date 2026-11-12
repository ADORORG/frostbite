import type { HeroId } from "../../src/rules/constants.ts";
import { savageRules } from "../../src/rules/index.ts";
import { advanceTo } from "../../src/rules/tick.ts";
import type { PlayState } from "../../src/rules/types.ts";
import { playWhole } from "./plan.ts";

// A whole run as a list of states, for the view's tests: the run the bot plays with a lead, replayed input by input, with a state every
// `every` ticks between them and a few seconds after the end. The view is shown each of them in turn, as the page would.
export function timelineOf(lead: HeroId, every = 30, seed = 7): PlayState[] {
  const bot = playWhole({ lead, seed });
  const init = savageRules.init(seed, {});
  if (!init.ok) throw new Error(init.reason);
  let state = init.state;
  const states: PlayState[] = [state];
  for (const input of bot.inputs) {
    const data = input.data;
    const tick =
      typeof data === "object" &&
      data !== null &&
      "tick" in data &&
      typeof data.tick === "number"
        ? data.tick
        : state.tick;
    for (let at = state.tick + every; at < tick; at += every)
      states.push((state = advanceTo(state, at)));
    const stepped = savageRules.step(state, input);
    if (!stepped.ok) throw new Error(stepped.reason);
    state = stepped.state;
    states.push(state);
  }
  for (let more = 0; more < 10; more += 1)
    states.push((state = advanceTo(state, state.tick + 30)));
  return states;
}
