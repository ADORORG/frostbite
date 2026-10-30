import type { RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a careful player's whole slope (1,046 ticks, about 35 seconds) on one seed, hopping
// each of the seventeen rocks once and only just clearing most. It earns all ten milestones. It is a plain record, not one built
// with the SDK's recorder, so the published verifier carries only the rules and not the recorder's schema library.
const hopTicks = [
  95, 173, 272, 342, 401, 453, 521, 577, 622, 656, 694, 747, 797, 842, 882, 933,
  988,
];

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-hop",
      "rock-hopper",
      "rock-master",
      "hundred-metres",
      "three-hundred-metres",
      "close-shave",
      "daredevil",
      "full-speed",
      "foot-of-the-slope",
      "tidy-run",
    ],
    config: {},
    gameId,
    inputs: [
      ...hopTicks.map((tick) => ({ data: { tick }, type: "hop" })),
      { data: { tick: 1_046 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_030,
    verifier: verifierId,
    verifierVersion,
  };
}
