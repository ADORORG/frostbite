import { startState, stepInt } from "@ador/game-sdk/seeded";

// The Sky Nursery, the secret bonus board a won quest opens: a night sky over a cloud nest where Glitchy flies freely, gathers the
// eggs floating about, hatches them in the nest into baby dragons (each with a name, up to twelve, who fly along behind), dances with
// them, and paints the sky with stars. Nothing in it is timed, scored, saved or sent; the rainbow door on the right leads out. It is a
// small state machine like the rules, seeded so a visit plays the same for the same presses, though it is never checked.
export type NurseryControl =
  | "act"
  | "charm"
  | "down"
  | "evade"
  | "fire"
  | "left"
  | "quick"
  | "right"
  | "up";
export const nurseryControls: readonly NurseryControl[] = [
  "left",
  "right",
  "up",
  "down",
  "act",
  "fire",
  "quick",
  "evade",
  "charm",
];

export interface Spot {
  readonly x: number;
  readonly y: number;
}
export interface Hatchling {
  readonly look: number;
  readonly name: string;
}
export interface NurseryEgg extends Spot {
  readonly look: number;
}
export interface Dot extends Spot {
  readonly ink: number;
}

export interface NurseryState {
  readonly carried: number;
  readonly collected: number;
  readonly controls: Readonly<Record<NurseryControl, boolean>>;
  // The dance move (0 to 2) and the tick it began (-1 before the first).
  readonly dance: number;
  readonly danceStart: number;
  readonly dragons: readonly Hatchling[];
  readonly eggs: readonly NurseryEgg[];
  readonly ended: boolean;
  readonly facing: -1 | 1;
  // The tick the last egg hatched (-1 before the first), and the colour of the paint.
  readonly hatchTick: number;
  readonly ink: number;
  readonly paint: readonly Dot[];
  readonly rng: number;
  readonly tick: number;
  // Where Glitchy has been, newest first, for the dragons following it.
  readonly trail: readonly Spot[];
  readonly x: number;
  readonly y: number;
}

export const names = [
  "PIP",
  "MOCHI",
  "ZAP",
  "BLOOP",
  "TWIG",
  "NOVA",
  "PUDDLE",
  "SPRITZ",
  "KIWI",
  "BEAN",
  "ZIGGY",
  "LUMI",
] as const;
export const looks = 8;
export const inks = 7;
export const mostDragons = names.length;
export const mostEggs = 6;
export const eggEvery = 90;
export const hatchEvery = 20;
export const danceTicks = 120;
export const mostDots = 1_200;
export const speed = 2;
export const nest: Spot = { x: 128, y: 118 };
export const nestReach = 18;
export const door = { bottom: 92, left: 244, top: 52 } as const;
export const followGap = 8;

function rolled(rng: number, bound: number): readonly [number, number] {
  const step = stepInt(rng, bound);
  return [step.value, step.state];
}

function newEgg(rng: number): readonly [NurseryEgg, number] {
  const [x, one] = rolled(rng, 200);
  const [y, two] = rolled(one, 70);
  const [look, three] = rolled(two, looks);
  return [{ look, x: 24 + x, y: 16 + y }, three];
}

export function startNursery(seed: number): NurseryState {
  let rng = startState(seed ^ 0x5eed_0008);
  const eggs: NurseryEgg[] = [];
  for (let at = 0; at < mostEggs; at += 1) {
    const [egg, next] = newEgg(rng);
    eggs.push(egg);
    rng = next;
  }
  return {
    carried: 0,
    collected: 0,
    controls: {
      act: false,
      charm: false,
      down: false,
      evade: false,
      fire: false,
      left: false,
      quick: false,
      right: false,
      up: false,
    },
    dance: 0,
    danceStart: -1,
    dragons: [],
    eggs,
    ended: false,
    facing: 1,
    hatchTick: -1,
    ink: 0,
    paint: [],
    rng,
    tick: 0,
    trail: [],
    x: 40,
    y: 70,
  };
}

export const dancing = (state: NurseryState): boolean =>
  state.danceStart >= 0 && state.tick - state.danceStart < danceTicks;
export const atNest = (spot: Spot): boolean =>
  Math.abs(spot.x - nest.x) <= nestReach &&
  Math.abs(spot.y - nest.y) <= nestReach;

// A press: dance (the next move each time), change the paint's colour back or on, or wipe the sky clean.
export function pressNursery(
  state: NurseryState,
  control: NurseryControl,
  on: boolean,
): NurseryState {
  const held = { ...state, controls: { ...state.controls, [control]: on } };
  if (!on || state.ended) return held;
  if (control === "act")
    return { ...held, dance: (state.dance + 1) % 3, danceStart: state.tick };
  if (control === "quick" || control === "evade")
    return {
      ...held,
      ink: (state.ink + (control === "evade" ? 1 : inks - 1)) % inks,
    };
  return control === "charm" ? { ...held, paint: [] } : held;
}

const clamp = (value: number, least: number, most: number): number =>
  Math.min(most, Math.max(least, value));

// A tick: Glitchy flies the way held; an egg touched is gathered (and a new one appears a while later); in the nest the eggs carried
// hatch one at a time; fire held paints; flying into the rainbow door ends the visit.
export function tickNursery(before: NurseryState): NurseryState {
  if (before.ended) return before;
  const { controls } = before;
  const across = Number(controls.right) - Number(controls.left);
  const down = Number(controls.down) - Number(controls.up);
  const x = clamp(before.x + across * speed, 8, 250);
  const y = clamp(before.y + down * speed, 10, 128);
  const tick = before.tick + 1;
  const touched = (egg: NurseryEgg) =>
    Math.abs(egg.x - x) <= 9 && Math.abs(egg.y - y) <= 9;
  const left = before.eggs.filter((egg) => !touched(egg));
  const gathered = before.eggs.length - left.length;
  let { rng } = before;
  let eggs = left;
  if (eggs.length < mostEggs && tick % eggEvery === 0) {
    const [egg, next] = newEgg(rng);
    eggs = [...eggs, egg];
    rng = next;
  }
  let state: NurseryState = {
    ...before,
    carried: before.carried + gathered,
    collected: before.collected + gathered,
    eggs,
    facing: across === 0 ? before.facing : across > 0 ? 1 : -1,
    rng,
    tick,
    trail:
      x === before.x && y === before.y
        ? before.trail
        : [{ x, y }, ...before.trail].slice(0, mostDragons * followGap),
    x,
    y,
  };
  const hatching =
    state.carried > 0 &&
    state.dragons.length < mostDragons &&
    atNest(state) &&
    (state.hatchTick < 0 || tick - state.hatchTick >= hatchEvery);
  if (hatching) {
    const [look, next] = rolled(state.rng, looks);
    state = {
      ...state,
      carried: state.carried - 1,
      dragons: [
        ...state.dragons,
        { look, name: names[state.dragons.length] ?? "PIP" },
      ],
      hatchTick: tick,
      rng: next,
    };
  }
  if (controls.fire && tick % 2 === 0)
    state = {
      ...state,
      paint: [
        ...state.paint,
        { ink: state.ink, x: x + state.facing * 9, y: y + 2 },
      ].slice(-mostDots),
    };
  const out = x >= door.left && y >= door.top && y <= door.bottom;
  return out ? { ...state, ended: true } : state;
}
