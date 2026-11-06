import type { RunRecord } from "@frostbite/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a minute of a player who sees the whole slope ahead, on one seed. The button goes down on the
// first tick listed, up on the second, down on the third, and so on; the run is closed on tick 3670. It earns 25 of the forty milestones:
// the ones a minute of faultless play reaches. It is a plain record, not one built with the SDK's recorder, so the published verifier
// carries only the rules and not the recorder's schema library.
const choices = [
  123, 176, 238, 240, 296, 298, 384, 443, 447, 503, 509, 511, 575, 577, 639,
  641, 723, 725, 779, 781, 849, 851, 925, 927, 997, 999, 1077, 1079, 1155, 1208,
  1208, 1267, 1291, 1347, 1347, 1349, 1415, 1465, 1481, 1483, 1551, 1553, 1625,
  1684, 1688, 1690, 1748, 1798, 1818, 1835, 1887, 1889, 1955, 2011, 2033, 2092,
  2092, 2145, 2165, 2215, 2267, 2326, 2332, 2388, 2394, 2450, 2452, 2511, 2541,
  2597, 2617, 2622, 2714, 2770, 2784, 2786, 2836, 2892, 2920, 2979, 2979, 2981,
  3015, 3074, 3108, 3164, 3164, 3166, 3200, 3256, 3294, 3353, 3357, 3359, 3423,
  3428, 3506, 3565, 3575, 3577, 3639, 3644,
];
const endTick = 3670;

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-hop",
      "score-500",
      "score-1500",
      "score-3000",
      "score-6000",
      "score-12000",
      "metres-100",
      "metres-250",
      "height-120",
      "height-200",
      "height-270",
      "airtime-24",
      "airtime-36",
      "shards-10",
      "shards-25",
      "shards-50",
      "shards-100",
      "clears-10",
      "clears-25",
      "clears-50",
      "boulders-10",
      "streak-2",
      "streak-4",
      "streak-6",
      "close-25",
    ],
    config: {},
    gameId,
    inputs: [
      ...choices.map((tick, index) => ({
        data: { on: index % 2 === 0 ? 1 : 0, tick },
        type: "hop",
      })),
      { data: { tick: endTick }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_030,
    verifier: verifierId,
    verifierVersion,
  };
}
