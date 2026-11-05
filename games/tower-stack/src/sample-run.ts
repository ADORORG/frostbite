import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: sixteen drops over about fifteen seconds on one seed, by a player who is a little late or early
// now and then. It earns nine of the milestones the rules can decide. It is a plain record, not one built with the SDK's recorder, so the
// published verifier carries only the rules and not the recorder's schema library.
const dropTicks = [
  39, 52, 109, 113, 158, 182, 250, 275, 276, 311, 320, 343, 378, 382, 411, 444,
];

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-block",
      "ten-high",
      "first-perfect",
      "perfect-ten",
      "triple",
      "five-streak",
      "ten-streak",
      "double-five",
      "regrown",
    ],
    config: {},
    gameId,
    inputs: [
      ...dropTicks.map((tick) => ({ data: { tick }, type: "drop" })),
      { data: { tick: 444 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_030,
    verifier: verifierId,
    verifierVersion,
  };
}
