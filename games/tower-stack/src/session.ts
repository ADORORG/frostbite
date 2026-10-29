import { createRunRecorder, type RunRecord } from "@ador/game-sdk/run-record";

import {
  gameId,
  maxTicks,
  verifierId,
  verifierVersion,
} from "./rules/constants.ts";
import { blockX } from "./rules/block.ts";
import { towerRules } from "./rules/index.ts";
import { startTower } from "./rules/state.ts";
import type { TowerState } from "./rules/types.ts";

export type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

// A block of the tower as it was set down, for the screen to draw (the rules keep only the top of the tower, which is all they need).
export interface Slab {
  readonly perfect: boolean;
  readonly width: number;
  readonly x: number;
}

// The part of a block that was trimmed off (or all of it, when the drop missed), and the tick on which it began to fall.
export interface Cut {
  readonly at: number;
  readonly width: number;
  readonly x: number;
}

// One run as the player plays it. The screen calls `tick` on its timer and `drop` when the player chooses; the rules decide what is legal,
// and the drops they accept (with the tick each was made on) are written into a run record. Only choices are recorded, never the ticks
// between them. There is no screen and no clock in this module.
export interface RunSession {
  // The tick the run is on now, and where the moving block is on it.
  clock(): number;
  cut(): Cut | null;
  drop(): Outcome;
  // The milestones the run has earned so far.
  earned(): readonly string[];
  movingX(): number;
  // Closes the run if it is still going and returns its record.
  record(): RunRecord;
  slabs(): readonly Slab[];
  state(): TowerState;
  // One tick. A run that is as long as it may be is closed.
  tick(): void;
}

export interface RunSessionOptions {
  // Called once for each milestone the run earns, as soon as the drop that earned it.
  readonly onEarned?: (milestone: string) => void;
  readonly seed: number;
}

const finished: Outcome = { ok: false, reason: "the run has ended" };

export function createRunSession(options: RunSessionOptions): RunSession {
  let state = startTower(options.seed);
  let clock = 0;
  let trimmed: Cut | null = null;
  const placed: Slab[] = [
    { perfect: false, width: state.width, x: state.topX },
  ];
  const announced = new Set<string>();
  const recorder = createRunRecorder({
    config: {},
    gameId,
    seed: options.seed,
    verifier: verifierId,
    verifierVersion,
  });

  function announce(): void {
    for (const milestone of towerRules.earned(state)) {
      if (announced.has(milestone)) continue;
      announced.add(milestone);
      options.onEarned?.(milestone);
    }
  }

  function apply(type: "drop" | "end"): Outcome {
    const data = { tick: clock };
    const stepped = towerRules.step(state, { data, type });
    if (!stepped.ok) return stepped;
    recorder.input(type, data);
    const before = state;
    state = stepped.state;
    if (type === "drop") settle(before);
    return { ok: true };
  }

  // What a drop left behind: the slab that stands, and what fell away from it.
  function settle(before: TowerState): void {
    const left = blockX(before, clock);
    if (state.over) {
      trimmed = { at: clock, width: before.width, x: left };
      return;
    }
    const perfect = state.perfects > before.perfects;
    placed.push({ perfect, width: state.width, x: state.topX });
    if (perfect) {
      announce();
      return;
    }
    if (left < before.topX)
      trimmed = { at: clock, width: before.topX - left, x: left };
    else if (left > before.topX)
      trimmed = {
        at: clock,
        width: left - before.topX,
        x: before.topX + before.width,
      };
    announce();
  }

  const close = (): Outcome => (state.ended ? { ok: true } : apply("end"));

  return {
    clock: () => clock,
    cut: () => trimmed,
    drop() {
      if (state.ended) return finished;
      const dropped = apply("drop");
      if (dropped.ok && state.over) close();
      return dropped;
    },
    earned: () => towerRules.earned(state),
    movingX: () => blockX(state, clock),
    record() {
      close();
      return recorder.finish(towerRules.earned(state));
    },
    slabs: () => placed,
    state: () => state,
    tick() {
      if (state.ended) return;
      clock += 1;
      if (clock >= maxTicks) close();
    },
  };
}
