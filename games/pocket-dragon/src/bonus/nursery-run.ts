import type { EffectName } from "../audio.ts";
import type { Action } from "../page/hands.ts";
import { holdOn, type PlayRun } from "../page/runs.ts";
import { nothing } from "../test-mode/sessions.ts";
import { drawNursery } from "./nursery-draw.ts";
import {
  dancing,
  nurseryControls,
  pressNursery,
  startNursery,
  tickNursery,
  type NurseryControl,
  type NurseryState,
} from "./nursery.ts";

// A visit to the Sky Nursery as the page plays it: like a test run, nothing in it is recorded, scored, saved or sent. Its keys are the
// ways, the action key (dance), fire (paint), Q and E (the paint's colour) and C (wipe the sky). It is heard as an egg is gathered, one
// hatches, a dance begins, and Glitchy flies out.
export interface NurseryRun extends PlayRun {
  nursery(): NurseryState;
}

const means: Readonly<Partial<Record<Action, NurseryControl>>> = {
  act: "act",
  charm: "charm",
  down: "down",
  evade: "evade",
  fire: "fire",
  left: "left",
  quick: "quick",
  right: "right",
  up: "up",
};

export function nurserySounds(
  before: NurseryState,
  after: NurseryState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  if (after.collected > before.collected) heard.push("egg");
  if (after.dragons.length > before.dragons.length) heard.push("freed");
  if (dancing(after) && after.danceStart !== before.danceStart)
    heard.push("levelup");
  if (after.ended && !before.ended) heard.push("whoosh");
  return heard;
}

export const nurseryNote =
  "The secret Sky Nursery: gather the eggs, hatch them in the nest, dance and paint the sky. Nothing here is counted; fly into the rainbow to leave, then Share card.";
export const nurseryOverNote =
  "You flew out of the Sky Nursery. Share card makes a card of your visit.";

export function nurseryRun(seed: number): NurseryRun {
  let state = startNursery(seed);
  const held = new Set<Action>();
  const press = (control: string, on: boolean): void => {
    const known = nurseryControls.find((name) => name === control);
    if (known !== undefined && state.controls[known] !== on)
      state = pressNursery(state, known, on);
  };
  return {
    cleared: () => [],
    depth: () => null,
    draw: (context) => drawNursery(context, state),
    earned: () => [],
    ended: () => state.ended,
    fame: () => null,
    hold: (action, on) => holdOn(means, held, action, on, press),
    id: "quest",
    level: () => "woods",
    nursery: () => state,
    overNote: nurseryOverNote,
    plasma: () => 0,
    record: () => nothing("quest", seed),
    score: () => 0,
    screen: "nursery",
    stats: () => [
      ["Eggs", String(state.collected)],
      ["Dragons", String(state.dragons.length)],
      ["Stars", String(state.paint.length)],
    ],
    test: true,
    tick() {
      const before = state;
      state = tickNursery(state);
      return nurserySounds(before, state);
    },
    won: () => false,
  };
}
