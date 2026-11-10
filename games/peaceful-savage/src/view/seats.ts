import type { HeroId } from "../rules/constants.ts";
import { things } from "../rules/things.ts";
import type { PlayState } from "../rules/types.ts";
import { company } from "./beside.ts";

// Sitting down, seen only: it changes nothing in the run. The act key on a seat (the couch, a bed's edge, the kitchen chair, the
// armchair, the bench in the meadow) is, to the rules, a thing touched; here the lead sits down on it, and the found sit beside them
// where there is room. Walking away stands them up; so does acting on the seat again, except on the swing, where each act is a push and
// the swing goes higher.
export interface Seat {
  // How high the seat is over the floor, in metres.
  readonly height: number;
  readonly kind: "seat" | "swing";
  // How far either side of its middle there is room to sit.
  readonly room: number;
  // The middle of where it is sat on, in metres.
  readonly x: number;
  // The way a sitter faces (0 is south, toward +z).
  readonly yaw: number;
  readonly z: number;
}

const north = Math.PI;
const south = 0;
const east = Math.PI / 2;

const seat = (
  x: number,
  z: number,
  yaw: number,
  height: number,
  room = 0,
): Seat => ({ height, kind: "seat", room, x, yaw, z });

// The swing hangs from a bough this high over the ground, on two ropes this long and this far either side of its middle.
export const swingHigh = 3.05;
export const swingRope = 2.5;
export const ropeApart = 0.27;
export const swingSeat: Seat = {
  ...seat(10.6, -7, north, swingHigh - swingRope),
  kind: "swing",
};

export const seats: Readonly<Record<string, Seat>> = {
  armchair: seat(4.5, 5.8, north, 0.5),
  bench: seat(-3.2, -4.15, north, 0.45, 0.5),
  bigbed: seat(9.8, 10.3, north, 0.56, 0.7),
  chair: seat(-6.4, 5.6, east, 0.46),
  couch: seat(0, 13.2, north, 0.5, 1.9),
  kaibed: seat(-10.5, 8.36, south, 0.56, 0.55),
  swing: swingSeat,
  zorabed: seat(-10.5, 12.74, north, 0.56, 0.55),
};

// How far apart two sit.
const apart = 0.62;
// How far the swing may swing (radians), how much a push adds, and how fast it dies down unpushed.
const highest = 0.82;
const pushed = 0.17;
const fading = 0.03;

// Where the found stand to watch the lead on the swing, clear of its arc: beyond the tree, facing it.
const watching: readonly (readonly [number, number])[] = [
  [2.5, -0.9],
  [2.8, 0],
  [2.5, 0.9],
];

export interface Watching {
  readonly x: number;
  readonly yaw: number;
  readonly z: number;
}

export interface Sitting {
  // How far forward the swing has swung, in radians (0 on any other seat).
  readonly angle: number;
  // Where each one who sits is sat: metres along the seat from its middle, toward the sitter's left.
  readonly along: ReadonlyMap<HeroId, number>;
  readonly id: string;
  readonly seat: Seat;
  // Where each of the found stands by to watch (the swing has room for one).
  readonly watching: ReadonlyMap<HeroId, Watching>;
}

// Where a sitter `along` a seat is, in metres.
export function seatAt(
  on: Seat,
  along: number,
): { readonly x: number; readonly z: number } {
  return {
    x: on.x + Math.cos(on.yaw) * along,
    z: on.z - Math.sin(on.yaw) * along,
  };
}

// Who sits where: the lead as near where they stood as the seat has room, and the found beside them, a side at a time, while it has.
function placesOn(on: Seat, state: PlayState): Map<HeroId, number> {
  const along = new Map<HeroId, number>();
  const lead = state.lead;
  if (lead === null) return along;
  const dx = state.x / 1000 - on.x;
  const dz = state.z / 1000 - on.z;
  const middle = Math.max(
    -on.room,
    Math.min(on.room, dx * Math.cos(on.yaw) - dz * Math.sin(on.yaw)),
  );
  along.set(lead, middle);
  const beside = [1, -1, 2, -2, 3, -3]
    .map((step) => middle + step * apart)
    .filter((place) => Math.abs(place) <= on.room + 0.05);
  company[lead]
    .filter((hero) => state.party.includes(hero))
    .forEach((hero, index) => {
      const place = beside[index];
      if (place !== undefined) along.set(hero, place);
    });
  return along;
}

export interface Seating {
  // Whether the lead sits this frame (and who with, and how the swing swings), from the state and the seconds since the last frame.
  update(state: PlayState, dt: number): Sitting | null;
}

export function createSeating(): Seating {
  let on: {
    readonly id: string;
    readonly index: number;
    readonly seat: Seat;
    readonly x: number;
    readonly z: number;
  } | null = null;
  // The tick of the last news heard, and of the last state seen (a new run begins again from nothing).
  let heard = -1;
  let seen = -1;
  let phase = 0;
  let swing = 0;
  let wanted = 0;
  return {
    update(state, dt) {
      if (state.tick < seen) {
        on = null;
        heard = -1;
      }
      seen = state.tick;
      const news = state.news;
      const fresh =
        news !== null && news.kind === "thing" && news.tick !== heard;
      if (news !== null) heard = news.tick;
      const still =
        state.lead !== null &&
        !state.ended &&
        state.moment === null &&
        state.moving < 0;
      // Up again: walking off, a moment beginning, the run ending.
      if (on !== null && (!still || state.x !== on.x || state.z !== on.z))
        on = null;
      if (fresh && still && news !== null) {
        const index = Number(news.detail);
        const id = things[index]?.id ?? "";
        const found = seats[id];
        if (found !== undefined) {
          if (on?.index !== index) {
            on = { id, index, seat: found, x: state.x, z: state.z };
            phase = 0;
            swing = 0;
            wanted = found.kind === "swing" ? pushed : 0;
          } else if (found.kind === "swing")
            wanted = Math.min(highest, wanted + pushed);
          else on = null;
        }
      }
      if (on === null) return null;
      // The swing: a pendulum as long as its ropes, as high as it has been pushed.
      phase += dt * Math.sqrt(9.81 / swingRope);
      swing += (wanted - swing) * (1 - Math.exp(-1.6 * dt));
      wanted = Math.max(0, wanted - fading * dt);
      const riding = on.seat.kind === "swing";
      const { x, z } = on.seat;
      const lead = state.lead;
      return {
        along: placesOn(on.seat, state),
        angle: riding ? swing * Math.sin(phase) : 0,
        id: on.id,
        seat: on.seat,
        watching: new Map(
          riding && lead !== null
            ? company[lead]
                .filter((hero) => state.party.includes(hero))
                .flatMap((hero, index): [HeroId, Watching][] => {
                  const [east = 0, south = 0] = watching[index] ?? [];
                  return [
                    [hero, { x: x + east, yaw: -Math.PI / 2, z: z + south }],
                  ];
                })
            : [],
        ),
      };
    },
  };
}
