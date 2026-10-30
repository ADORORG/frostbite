import type { RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a player's whole slope (1,046 ticks, about 35 seconds) on one seed, hopping each of the
// seventeen rocks once, late, and cutting ten of them fine. It earns thirty-nine of the forty milestones (all but the comfortable run, which
// needs the opposite). It is a plain record, not one built
// with the SDK's recorder, so the published verifier carries only the rules and not the recorder's schema library.
const hopTicks = [
  96, 173, 272, 342, 401, 453, 521, 577, 622, 656, 694, 748, 798, 842, 882, 933,
  989,
];

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-hop",
      "first-rock",
      "three-rocks",
      "rock-hopper",
      "eight-rocks",
      "ten-rocks",
      "twelve-rocks",
      "rock-master",
      "metres-25",
      "metres-50",
      "metres-75",
      "metres-100",
      "metres-125",
      "metres-150",
      "metres-175",
      "metres-200",
      "metres-225",
      "metres-250",
      "metres-275",
      "full-speed",
      "metres-325",
      "metres-350",
      "metres-375",
      "metres-400",
      "metres-425",
      "metres-450",
      "metres-475",
      "metres-500",
      "metres-525",
      "metres-550",
      "metres-575",
      "close-shave",
      "three-close",
      "daredevil",
      "eight-close",
      "foot-of-the-slope",
      "tidy-run",
      "sharp-finish",
      "razor-finish",
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
