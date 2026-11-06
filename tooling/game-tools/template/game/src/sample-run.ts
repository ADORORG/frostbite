import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: twenty-six catches over about twenty seconds on one seed. It earns every milestone the rules can
// decide. It is a plain record, not one built with the SDK's recorder, so the published verifier carries only the rules and not the
// recorder's schema library.
const tapTicks = [
  38, 72, 73, 166, 272, 273, 313, 373, 374, 402, 412, 444, 445, 446, 484, 499,
  504, 505, 512, 518, 548, 549, 552, 568, 577, 578,
];

export function sampleRun(): RunRecord {
  return {
    claims: ["first-catch", "first-five", "ten-catches", "twenty-five"],
    config: {},
    gameId,
    inputs: [
      ...tapTicks.map((tick) => ({ data: { tick }, type: "tap" })),
      { data: { tick: 578 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_106,
    verifier: verifierId,
    verifierVersion,
  };
}
