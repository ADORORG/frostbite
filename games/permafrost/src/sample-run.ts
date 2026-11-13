import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a steady player clearing 26 rows in about 134 seconds. It earns the milestones of the first levels.
// It is a plain record, not one built with the SDK's recorder, so the published verifier carries only the rules and not the recorder's
// schema library. Each key is "the ticks since the last, then the key": l and r slide, a and b turn, d drops, h holds, s and S start and
// stop the soft drop. A record holds a few hundred keys in each input, as the session writes them.
const batches = [
  `
90r4r4r4r4d94d94l4l4l4d94l4l4l4d94a4l4l4l4l4d94d94a4l4l4d94a4l4l4l4l4l4d94l4l4l4d94r4r4r4d94a4d94r4r4r4d94b4r4r4r4r4r4d
94r4r4d94a4a4d94l4l4l4d94l4d94a4r4r4r4d94r4r4d94a4r4r4r4d94a4r4d94b4r4r4r4r4r4d94a4a4l4l4d94a4l4d94a4a4r4r4d94r4r4d94r4r
4r4r4d94a4l4l4d94a4l4l4l4l4l4d94a4l4l4d94a4a4r4r4d94b4l4l4l4d94b4r4r4r4r4r4d94r4r4r4d94b4d94a4l4l4l4d94a4r4d94a4l4d94r4r
4r4r4d94a4a4r4r4r4r4d94l4l4l4d94a4r4d94a4a4d94l4l4d94b4r4d94l4d94a4l4l4l4l4l4d94a4r4r4r4d
`.replaceAll("\n", ""),
  `
94a4a4r4r4d94a4a4d94b4r4r4d94b4r4d94l4l4l4l4d94a4r4r4r4r4d94a4l4l4l4d94b4r4r4r4r4r4d94a4r4r4r4d94l4l4d94a4a4l4d94b4l4l4l
4l4d94b4r4r4r4r4r4d94b4r4r4r4d94d94a4a4l4l4d94b4l4l4l4d94a4r4r4r4r4d94d94a4l4l4d94r4r4r4d94b4r4r4d94a4l4l4l4l4d94a4a4r4r
4r4d94a4a4l4l4l4d94a4r4r4r4r4d94b4d
`.replaceAll("\n", ""),
];

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-line",
      "lines-10",
      "lines-25",
      "level-3",
      "score-1k",
      "score-5k",
    ],
    config: {},
    gameId,
    inputs: [
      ...batches.map((keys) => ({ data: { keys }, type: "keys" })),
      { data: { tick: 8046 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20261112,
    verifier: verifierId,
    verifierVersion,
  };
}
