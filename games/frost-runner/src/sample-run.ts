import type { RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a careful player's first 520 ticks (about 17 seconds) on one seed. It earns four of the
// milestones the rules can decide. It is a plain record, not one built with the SDK's recorder, so the published verifier carries only
// the rules and not the recorder's schema library.
const choice = (type: "jump" | "slide", tick: number) => ({
  data: { tick },
  type,
});

export function sampleRun(): RunRecord {
  return {
    claims: ["first-steps", "shard-10", "sky-picker", "hurdler"],
    config: {},
    gameId,
    inputs: [
      choice("jump", 55),
      choice("jump", 103),
      choice("jump", 143),
      choice("slide", 190),
      choice("jump", 235),
      choice("jump", 284),
      choice("jump", 329),
      choice("jump", 368),
      choice("jump", 406),
      choice("slide", 452),
      choice("jump", 486),
      { data: { tick: 520 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_015,
    verifier: verifierId,
    verifierVersion,
  };
}
