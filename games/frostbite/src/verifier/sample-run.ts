import type { RunInput, RunRecord } from "@ador/game-sdk/run-record";

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
// glacier tier's cost), settle it, and build the first glacier. It earns both milestones the rules can decide. It is a plain
// record, not one built with the SDK's recorder, so the published verifier artifact carries only the rules and not the
// recorder's schema library (the cabinet itself records with the recorder).
const seed = 20_261_015;

export function iceFieldSampleRun(): RunRecord {
  const mines = iceFieldMines(seed, 0, defaultMines);
  const inputs: RunInput[] = [];
  for (let tile = 0; tile < cells; tile += 1)
    if (!mines.includes(tile)) inputs.push({ data: tile, type: "pick" });
  inputs.push({ type: "settle" }, { data: 1, type: "build-glacier" });
  return {
    claims: [firstWin, firstGlacier],
    config: { mines: defaultMines },
    gameId: iceFieldGameId,
    inputs,
    schemaVersion: 1,
    seed,
    verifier: iceFieldVerifierId,
    verifierVersion: iceFieldVersion,
  };
}
