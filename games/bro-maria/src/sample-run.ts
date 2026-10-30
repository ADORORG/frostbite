import type { RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a hero that holds right the whole way and jumps over each pit, step, urchin and slime as it comes,
// across a whole level in about forty seconds on one seed. It earns thirteen of the milestones the rules can decide (a stomp on the way is luck). It is a plain record,
// not one built with the SDK's recorder, so the published verifier carries only the rules and not the recorder's schema library.
// Each choice is the tick, whether the control was pressed (1) or let go of (0), and which control.
const choices = [
  [0, 1, "right"],
  [240, 1, "jump"],
  [310, 0, "jump"],
  [545, 1, "jump"],
  [581, 0, "jump"],
  [609, 1, "jump"],
  [679, 0, "jump"],
  [693, 1, "jump"],
  [729, 0, "jump"],
  [737, 1, "jump"],
  [807, 0, "jump"],
  [956, 1, "jump"],
  [1060, 0, "jump"],
  [1454, 1, "jump"],
  [1486, 0, "jump"],
  [1590, 1, "jump"],
  [1622, 0, "jump"],
  [1739, 1, "jump"],
  [1775, 0, "jump"],
  [1838, 1, "jump"],
  [1908, 0, "jump"],
  [2072, 1, "jump"],
  [2104, 0, "jump"],
  [2277, 1, "jump"],
  [2347, 0, "jump"],
] as const;
const endTick = 2503;

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-steps",
      "quarter-way",
      "halfway",
      "three-quarters",
      "finish",
      "first-coin",
      "coins-10",
      "coins-25",
      "coins-50",
      "first-stomp",
      "stomps-5",
      "untouched",
      "speedrun",
    ],
    config: {},
    gameId,
    inputs: [
      ...choices.map(([tick, on, type]) => ({ data: { on, tick }, type })),
      { data: { tick: endTick }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_031,
    verifier: verifierId,
    verifierVersion,
  };
}
