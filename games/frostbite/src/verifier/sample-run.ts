import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import {
  cells,
  defaultMines,
  firstGlacier,
  firstWin,
  iceFieldGameId,
  iceFieldMines,
  iceFieldVerifierId,
  iceFieldVersion,
} from "./ice-field.ts";

// One legal run the verifier is shown with: clear every safe tile of the first board (the bonus pays well over the first
// glacier tier's cost), settle it, and build the first glacier. It earns both milestones the rules can decide. Built with
// the SDK's recorder, as the game itself would, so it is also the reference for how a game records a run.
const seed = 20_261_015;

export function iceFieldSampleRun(): RunRecord {
  const mines = iceFieldMines(seed, 0, defaultMines);
  const recorder = createRunRecorder({
    config: { mines: defaultMines },
    gameId: iceFieldGameId,
    seed,
    verifier: iceFieldVerifierId,
    verifierVersion: iceFieldVersion,
  });
  for (let tile = 0; tile < cells; tile += 1)
    if (!mines.includes(tile)) recorder.input("pick", tile);
  recorder.input("settle");
  recorder.input("build-glacier", 1);
  return recorder.finish([firstWin, firstGlacier]);
}
