import type { RunRecord } from "@ador/game-sdk/run-record";

import {
  directions,
  gameId,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";

// One legal run the verifier is shown with: a player who sees the whole cellar, and takes the shortest way to each key and door, and a
// flask when the oil allows, down six floors on one seed. Each letter is a step (u up, r right, d down, l left); the run is closed after
// the last. It earns 16 of the forty milestones. It is a plain record, not one built with the SDK's recorder, so the published
// verifier carries only the rules and not the recorder's schema library.
const steps =
  "drrrullrrrdrrdlddlluurdulddrruurulluldllludrurddldlddrruururddldrruruluuullrrrrdldrdddlruuulurullddd" +
  "rdldlluruuldlddlluururuuldludrdrrrurrrurdddddllululddlulurlllddrudrlluurrdrdruurdrdrruuuuuldllldlllu" +
  "lurrrrdldlulddrrdldrrurruuuurddruurdddldddluldlllllluruluuudddrdldrrrrrruruudddruuuruuulddluulddddll" +
  "dllurulluurdrurullllrrdldlddddruurulrrrurddldlldrrrruurdrurddruuuuluuldlllurrlldrdrrdllrrullululldrl" +
  "urrdrrrurddrddddluuldlulddllllurruruuldlldlddluuuururulldrrurddldrrruulduurrdrdrdruulurrdrudddldllll" +
  "urldddrurrrrdldlllllllururulldldluuulurldrdddrururrdldldrrrrrrrurulllldluurrrruruululldrddlulululldr" +
  "ddllluruuldllu";
const letters = "urdl";

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-step",
      "floors-1",
      "floors-3",
      "floors-5",
      "flasks-5",
      "lean-1",
      "lean-3",
      "sweep-1",
      "sweep-3",
      "sweep-6",
      "streak-2",
      "oil-200",
      "oil-250",
      "steps-300",
      "score-1500",
      "score-4000",
    ],
    config: {},
    gameId,
    inputs: [
      ...[...steps].map((letter) => ({
        type: directions[letters.indexOf(letter)] ?? "up",
      })),
      { type: "end" },
    ],
    schemaVersion: 1,
    seed: 20_261_030,
    verifier: verifierId,
    verifierVersion,
  };
}
