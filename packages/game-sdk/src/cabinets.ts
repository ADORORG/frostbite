import type { GameVerifier, RunInput, Stepped } from "./run-record.ts";
import type { JsonValue } from "./protocol.ts";

// A game with several cabinets publishes one verifier: the platform holds one set of rules per game. This builds it from
// the rules of each cabinet. A record names its cabinet in its settings (`config.cabinet`); the remaining settings go to
// that cabinet's rules untouched, and every later step is theirs. Nothing here knows any game.

export const cabinetSetting = "cabinet";

// A run in progress under one cabinet's rules. The cabinets' states have different shapes, so each is held behind the
// functions that work on it instead of being typed away.
export interface CabinetRun {
  earned(): readonly string[];
  score(): number | null;
  step(input: RunInput): Stepped<CabinetRun>;
}

function running<State>(rules: GameVerifier<State>, state: State): CabinetRun {
  return {
    earned: () => rules.earned(state),
    score: () => rules.score?.(state) ?? null,
    step(input) {
      const stepped = rules.step(state, input);
      return stepped.ok
        ? { ok: true, state: running(rules, stepped.state) }
        : stepped;
    },
  };
}

// One cabinet's rules, ready to be named in `combineCabinets`.
export interface Cabinet {
  start(
    seed: number,
    config: Readonly<Record<string, JsonValue>>,
  ): Stepped<CabinetRun>;
}

export function cabinet<State>(rules: GameVerifier<State>): Cabinet {
  return {
    start(seed, config) {
      const started = rules.init(seed, config);
      return started.ok
        ? { ok: true, state: running(rules, started.state) }
        : started;
    },
  };
}

export interface CombinedCabinets {
  readonly cabinets: Readonly<Record<string, Cabinet>>;
  readonly id: string;
  readonly version: number;
}

export function combineCabinets(
  options: CombinedCabinets,
): GameVerifier<CabinetRun> {
  const names = Object.keys(options.cabinets);
  return {
    earned: (run) => run.earned(),
    id: options.id,
    score: (run) => run.score(),
    init(seed, config) {
      const { [cabinetSetting]: name, ...settings } = config;
      const chosen =
        typeof name === "string" && names.includes(name)
          ? options.cabinets[name]
          : undefined;
      if (chosen === undefined)
        return {
          ok: false,
          reason: `${cabinetSetting} must be one of: ${names.join(", ")}`,
        };
      return chosen.start(seed, settings);
    },
    step: (run, input) => run.step(input),
    version: options.version,
  };
}
