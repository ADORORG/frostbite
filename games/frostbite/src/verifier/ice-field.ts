import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@ador/game-sdk/run-record";

import { pickDistinct } from "./seeded.ts";

// FROST·BITE's replayable board: the pick-based "predictive minefield" the game is described as. Pick tiles on a 5x5
// field of frost; a mine ends the board; settle it to bank the safe picks as icicles; spend icicles on a glacier. It is
// deterministic, so the platform can replay a run and say which milestones it earned. It is NOT the game's real-time
// cabinets: those cannot be replayed yet (docs/product/run-record.md), and nothing here claims they can.
//
// The numbers mirror the game's own economy (`games/frostbite/src/legacy/app.jsx` and `progression.jsx`): the base
// payout, its factor, the bonus for clearing a board, and the glacier tier costs.

export const iceFieldVerifierId = "ice-field";
export const iceFieldVersion = 1;

export const cells = 25;
// The game's default mine count (its tweak default), and the most a board may have (two tiles stay safe).
export const defaultMines = 5;
export const maxMines = cells - 2;
export const icicleBase = 50;
export const payoutFactor = 0.55;
export const clearBonus = 1.5;
// Each board of a run has its own layout, from the run's seed and the board's place in the run.
export const boardSeedStep = 131;
export const maxBoards = 64;
export const glacierCosts: readonly number[] = [300, 1_200, 4_200];

// The milestone ids this verifier can earn: the ones the manifest declares and the rules can decide.
export const firstWin = "first-win";
export const firstGlacier = "first-glacier";

interface Board {
  readonly busted: boolean;
  readonly mines: readonly number[];
  readonly picks: readonly number[];
}
export interface IceFieldState {
  readonly board: Board;
  readonly boardIndex: number;
  readonly glacierTier: number;
  readonly icicles: number;
  readonly mineCount: number;
  readonly seed: number;
  readonly wins: number;
}

// Where the mines are on a board of a run: the same for the same seed, board and mine count, whoever asks.
export function iceFieldMines(
  seed: number,
  boardIndex: number,
  mineCount: number,
): readonly number[] {
  return pickDistinct(
    (seed + boardIndex * boardSeedStep) >>> 0,
    cells,
    mineCount,
  );
}

const freshBoard = (
  seed: number,
  boardIndex: number,
  mineCount: number,
): Board => ({
  busted: false,
  mines: iceFieldMines(seed, boardIndex, mineCount),
  picks: [],
});

const refuse = (reason: string): { ok: false; reason: string } => ({
  ok: false,
  reason,
});
const wholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

// The icicles a settled board pays: the safe picks times the base and factor, and a bonus for clearing every safe tile.
export function payout(safePicks: number, mineCount: number): number {
  const bonus = safePicks === cells - mineCount ? clearBonus : 1;
  return Math.round(safePicks * icicleBase * payoutFactor * bonus);
}

function init(
  seed: number,
  config: Readonly<Record<string, unknown>>,
): Stepped<IceFieldState> {
  for (const key of Object.keys(config))
    if (key !== "mines") return refuse(`no such setting: ${key}`);
  // A setting that is given is checked, whatever it is: `null` is not "not given".
  const mineCount = "mines" in config ? config.mines : defaultMines;
  if (!wholeNumber(mineCount) || mineCount < 1 || mineCount > maxMines)
    return refuse(`mines must be a whole number from 1 to ${String(maxMines)}`);
  return {
    ok: true,
    state: {
      board: freshBoard(seed, 0, mineCount),
      boardIndex: 0,
      glacierTier: 0,
      icicles: 0,
      mineCount,
      seed,
      wins: 0,
    },
  };
}

function pick(state: IceFieldState, data: unknown): Stepped<IceFieldState> {
  const { board } = state;
  if (board.busted) return refuse("the board is over: settle it");
  if (!wholeNumber(data) || data < 0 || data >= cells)
    return refuse(`pick takes a tile from 0 to ${String(cells - 1)}`);
  if (board.picks.includes(data)) return refuse("that tile is already picked");
  return {
    ok: true,
    state: {
      ...state,
      board: {
        ...board,
        busted: board.mines.includes(data),
        picks: [...board.picks, data],
      },
    },
  };
}

function settle(state: IceFieldState): Stepped<IceFieldState> {
  const { board, boardIndex, mineCount } = state;
  if (boardIndex + 1 >= maxBoards)
    return refuse("a run has no more boards after this one");
  const safePicks = board.picks.length - (board.busted ? 1 : 0);
  // A board is won when it was played (a safe pick) and no mine was struck.
  const won = !board.busted && safePicks > 0;
  return {
    ok: true,
    state: {
      ...state,
      board: freshBoard(state.seed, boardIndex + 1, mineCount),
      boardIndex: boardIndex + 1,
      icicles: state.icicles + (won ? payout(safePicks, mineCount) : 0),
      wins: state.wins + (won ? 1 : 0),
    },
  };
}

function buildGlacier(
  state: IceFieldState,
  data: unknown,
): Stepped<IceFieldState> {
  if (!wholeNumber(data) || data !== state.glacierTier + 1)
    return refuse("a glacier tier is built in order, starting with 1");
  const cost = glacierCosts[data - 1];
  if (cost === undefined) return refuse("there is no such glacier tier");
  if (state.icicles < cost) return refuse("not enough icicles for that tier");
  return {
    ok: true,
    state: { ...state, glacierTier: data, icicles: state.icicles - cost },
  };
}

export const iceFieldRules: GameVerifier<IceFieldState> = {
  earned: ({ glacierTier, wins }) => [
    ...(wins >= 1 ? [firstWin] : []),
    ...(glacierTier >= 1 ? [firstGlacier] : []),
  ],
  id: iceFieldVerifierId,
  init,
  step: (state, input: RunInput) => {
    switch (input.type) {
      case "pick":
        return pick(state, input.data);
      case "settle":
        return settle(state);
      case "build-glacier":
        return buildGlacier(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: iceFieldVersion,
};
