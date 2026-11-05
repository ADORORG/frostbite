import {
  createRunRecorder,
  type RunRecord,
} from "@frostbite/game-sdk/run-record";

import {
  defaultMines,
  glacierCosts,
  iceFieldGameId,
  iceFieldRules,
  type IceFieldState,
} from "../verifier/ice-field.ts";
import {
  frostbiteVerifierId,
  frostbiteVerifierVersion,
  iceFieldCabinetName,
} from "../verifier/frostbite.ts";

export type SettleResult = "busted" | "skipped" | "won";

export type Outcome =
  | {
      readonly ok: true;
      // Set when the input settled a board: how it ended and what it paid.
      readonly settled?: {
        readonly gained: number;
        readonly result: SettleResult;
      };
    }
  | { readonly ok: false; readonly reason: string };

// One run of the ice field, as the player plays it: the platform's own rules decide what is legal, and every input the
// rules accept is written into a run record. A refused input changes nothing and is not recorded, so the record is
// always a legal run. There is no screen in this module.
export interface IceFieldSession {
  buildGlacier(): Outcome;
  earned(): readonly string[];
  // The icicles the next glacier tier costs, or null when every tier is built.
  nextGlacierCost(): number | null;
  pick(tile: number): Outcome;
  // The run so far as a record, claiming what it has earned. It can be taken at any point and does not end the run.
  record(): RunRecord;
  settle(): Outcome;
  state(): IceFieldState;
  // How many inputs the rules have accepted.
  steps(): number;
}

export interface IceFieldSessionOptions {
  readonly mines?: number;
  // Called once for each milestone the run earns, as soon as the input that earned it is accepted.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

export function createIceFieldSession(
  options: IceFieldSessionOptions,
): IceFieldSession {
  const mines = options.mines ?? defaultMines;
  const started = iceFieldRules.init(options.seed, { mines });
  if (!started.ok) throw new RangeError(started.reason);
  let state = started.state;
  let steps = 0;
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: { cabinet: iceFieldCabinetName, mines },
    gameId: iceFieldGameId,
    seed: options.seed,
    verifier: frostbiteVerifierId,
    verifierVersion: frostbiteVerifierVersion,
  });

  function apply(
    type: string,
    data?: number,
  ): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    const input = data === undefined ? { type } : { data, type };
    const stepped = iceFieldRules.step(state, input);
    if (!stepped.ok) return stepped;
    state = stepped.state;
    steps += 1;
    recorder.input(type, data);
    for (const milestone of iceFieldRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
    return { ok: true };
  }

  return {
    buildGlacier() {
      const cost = glacierCosts[state.glacierTier];
      if (cost === undefined)
        return { ok: false, reason: "every glacier tier is built" };
      return apply("build-glacier", state.glacierTier + 1);
    },
    earned: () => iceFieldRules.earned(state),
    nextGlacierCost: () => glacierCosts[state.glacierTier] ?? null,
    pick: (tile) => apply("pick", tile),
    record: () => recorder.finish(iceFieldRules.earned(state)),
    settle() {
      const { board } = state;
      const before = state.icicles;
      const safePicks = board.picks.length - (board.busted ? 1 : 0);
      const result: SettleResult = board.busted
        ? "busted"
        : safePicks === 0
          ? "skipped"
          : "won";
      const applied = apply("settle");
      return applied.ok
        ? { ok: true, settled: { gained: state.icicles - before, result } }
        : applied;
    },
    state: () => state,
    steps: () => steps,
  };
}
