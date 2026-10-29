import type { RunInput, RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with: a plain player's first 130 moves on one seed (d is down, l left, r right, u up). It earns
// nine of the milestones the rules can decide. It is a plain record, not one built with the SDK's recorder, so the published verifier
// carries only the rules and not the recorder's schema library.
const moves =
  "dldldlddddddddldldlddddddldddldddddrdddldddlddddlddddldldddlddlddlddddddddldddldddldldddddddddldlddrlddrddddlddldddldlddldlrdldddd";
const names = { d: "down", l: "left", r: "right", u: "up" } as const;

export function sampleRun(): RunRecord {
  const inputs: RunInput[] = [...moves].map((letter) => ({
    type: names[letter as keyof typeof names],
  }));
  return {
    claims: [
      "tile-64",
      "tile-128",
      "score-1k",
      "moves-100",
      "double-up",
      "four-at-once",
      "on-a-roll",
      "spacious",
      "quick-128",
    ],
    config: {},
    gameId,
    inputs: [...inputs, { type: "end" }],
    schemaVersion: 1,
    seed: 20_261_016,
    verifier: verifierId,
    verifierVersion,
  };
}
