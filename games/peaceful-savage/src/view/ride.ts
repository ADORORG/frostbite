import { ease, farewell } from "./farewell.ts";

// The ride after the show: a hover car, all curves, glides onto the lawn; the family climbs in and rides it round the meadow, skimming
// the grass or lifting high over the trees, and it brings them home to the lawn for the lift-off. The player drives it (the page's
// hands keep where it is, see page/stage-hands.ts); left alone, it cruises a wide figure of eight by itself. The run is over: none of
// this changes anything in it.
export interface Ride {
  // How high it hovers over the ground, in metres.
  readonly high: number;
  readonly x: number;
  // The way it points, as a yaw (0 faces +z, the house; pi faces out over the meadow, and the camera).
  readonly yaw: number;
  readonly z: number;
}

// Where it waits on the lawn, how high it hovers at rest, and how high its floor is over its underside.
export const home: Ride = { high: 0.5, x: 0, yaw: Math.PI, z: -4.6 };
export const carFloor = 0.22;
// How far it may go: the meadow, inside its hedge, this side of the house.
export const range = { east: 14.4, north: -25.4, south: -2.6, top: 7.5 };

// Each one's seat, by their place in the line from the screen's left (Daddy, Kai, Zora, Mama): the children in front, the grown-ups
// behind and a little higher; across the car, along it, and the seat's height over the floor.
export const carSeats = [
  { across: 0.44, along: -0.62, high: 0.5 },
  { across: 0.4, along: 0.42, high: 0.34 },
  { across: -0.4, along: 0.42, high: 0.34 },
  { across: -0.44, along: -0.62, high: 0.5 },
] as const;

export const inRange = (x: number, z: number): { x: number; z: number } => ({
  x: Math.max(-range.east, Math.min(range.east, x)),
  z: Math.max(range.north, Math.min(range.south, z)),
});

// Left alone, where it cruises, `t` seconds into the ride: out from the lawn and round a figure of eight, rising and falling.
export function cruise(t: number): Ride {
  const at = (time: number) => ({
    x: 10.5 * Math.sin(time * 0.36),
    z: -14.5 + 7.5 * Math.sin(time * 0.72 + Math.PI),
  });
  const out = ease(0, 3.5, t);
  const here = at(t);
  const next = at(t + 0.1);
  return {
    high: home.high + out * (1.1 + 1.6 * Math.sin(t * 0.25) ** 2),
    x: home.x + (here.x - home.x) * out,
    yaw: Math.atan2(next.x - here.x, next.z - here.z),
    z: home.z + (here.z - home.z) * out,
  };
}

const turned = (from: number, to: number, by: number): number => {
  const round = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + round * by;
};

export interface Riding extends Ride {
  // How much of the car there is (0 to 1): it glides in as the show ends and lifts away once the family has stepped out.
  readonly shown: number;
  // Whether the family is in it.
  readonly aboard: boolean;
}

// The car in the farewell, `since` seconds after the tree was lit: where the player has driven it, or its own cruise; home on the lawn
// before the ride and brought home again over its last seconds. Null before the show ends.
export function rideIn(since: number, driven: Ride | null): Riding | null {
  const [start, end] = farewell.ride;
  if (since < farewell.show[1] - 0.5) return null;
  const shown =
    ease(farewell.show[1] - 0.5, farewell.show[1] + 1, since) *
    (1 - ease(farewell.hands - 0.6, farewell.hands + 1.4, since));
  const aboard = since >= start && since < end + 0.4;
  if (since < start) return { ...home, aboard, shown };
  const free = driven ?? cruise(since - start);
  // Home again: eased back to the lawn over the ride's last seconds, then away up as it goes.
  const back = ease(end - 3.2, end, since);
  const away = ease(farewell.hands - 0.6, farewell.hands + 1.4, since);
  return {
    aboard,
    high: free.high + (home.high - free.high) * back + away * 6,
    shown,
    x: free.x + (home.x - free.x) * back,
    yaw: turned(free.yaw, home.yaw, back),
    z: free.z + (home.z - free.z) * back,
  };
}

// Where a seat is on the ground plan, for a car at a place pointing a way.
export function seatOf(ride: Ride, line: number): { x: number; z: number } {
  const seat = carSeats[line] ?? carSeats[0];
  const [sin, cos] = [Math.sin(ride.yaw), Math.cos(ride.yaw)];
  return {
    x: ride.x + seat.across * cos + seat.along * sin,
    z: ride.z - seat.across * sin + seat.along * cos,
  };
}
