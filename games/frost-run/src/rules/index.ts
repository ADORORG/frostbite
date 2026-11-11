import type { JsonValue } from "@frostbite/game-sdk/protocol";
import { refuse } from "@frostbite/game-sdk/run-inputs";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@frostbite/game-sdk/run-record";

import { verifierId, verifierVersion } from "./constants.ts";
import { earnedIds } from "./milestones.ts";
import { changePad, chooseLead, endAt, startRun } from "./state.ts";
import type { RunState } from "./types.ts";

export { leads, leadIds, type Lead, type LeadId } from "./leads.ts";
export { levels, levelAt } from "./levels.ts";
export { milestones } from "./milestones.ts";
export { needed, totals } from "./round.ts";
export { advanceTo } from "./tick.ts";
export type * from "./types.ts";

// The inputs a run is made of. Each is small on purpose: a run of three rounds can hold a thousand of them and stay well inside a record.
//   lead  data: the lead's place in the list (the first input of every run, at tick 0)
//   p     data: [tick, way, buttons]: the hands changed (way -1 is no direction; buttons are bits: hop, duck, shoot, grow, vision)
//   end   data: tick: the run stops here if it has not already ended
export const inputTypes = { end: "end", lead: "lead", pad: "p" } as const;

const wholeNumbers = (
  data: JsonValue | undefined,
  count: number,
): number[] | string => {
  if (!Array.isArray(data) || data.length !== count)
    return `the input takes ${count} whole numbers`;
  const numbers: number[] = [];
  for (const value of data) {
    if (typeof value !== "number" || !Number.isInteger(value))
      return `the input takes ${count} whole numbers`;
    numbers.push(value);
  }
  return numbers;
};

const fromOutcome = (
  outcome: ReturnType<typeof changePad>,
): Stepped<RunState> =>
  outcome.ok ? { ok: true, state: outcome.state } : refuse(outcome.reason);

export const rules: GameVerifier<RunState> = {
  earned: (state) => earnedIds(state),
  id: verifierId,
  init(seed, config) {
    if (Object.keys(config).length > 0)
      return refuse("the game takes no settings");
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      return refuse("the seed must be a whole number of 32 bits");
    return { ok: true, state: startRun(seed) };
  },
  step(state, input: RunInput) {
    if (input.type === inputTypes.lead) {
      if (typeof input.data !== "number")
        return refuse("the lead takes one whole number");
      return fromOutcome(chooseLead(state, input.data));
    }
    if (input.type === inputTypes.pad) {
      const numbers = wholeNumbers(input.data, 3);
      if (typeof numbers === "string") return refuse(numbers);
      const [tick = 0, way = 0, buttons = 0] = numbers;
      return fromOutcome(changePad(state, tick, way, buttons));
    }
    if (input.type === inputTypes.end) {
      if (typeof input.data !== "number" || !Number.isInteger(input.data))
        return refuse("the end takes one whole number");
      return fromOutcome(endAt(state, input.data));
    }
    return refuse(`unknown input ${input.type}`);
  },
  // The score is the rules' own: crystals, eggs and keys by their worth, and the seconds left on a round swept clean.
  score: (state) => (state.ended ? state.score : null),
  version: verifierVersion,
};
