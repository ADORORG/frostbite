import { Vector3 } from "three";

import { home, seatOf } from "./ride.ts";
import { singAt, stage } from "./show.ts";
import type { Ending } from "./world.ts";

// The farewell, once the tree is lit (the seconds since). It always happens at home, at the tree, wherever the snake was healed:
//   0 to 2.8    the family stands at the ancestor tree in the hall, facing it, as its third strand lights fully;
//   2.4 to 3.6  they turn round, one after another, to face the screen, as the ancestors fade in round the tree behind them;
//   3.4 to 9.6  the big hug, side by side, facing the screen, the ancestors shining behind them: the picture the share card keeps;
//   8.2 to 9.6  the ancestors fade into the tree;
//   9.6 to 16.4 they dance out of the front door, across the lawn and up onto a stage that fades in there, to the drums;
//   16.4 to 76.4 the show (see show.ts): sixty seconds of singing and dancing to the screen, the band of ancestors behind them, the
//               ancestors dancing all round; the player takes one of the family at a time and moves them about the stage;
//   76.4 to 78.4 the stage fades; a hover car glides onto the lawn and they climb in;
//   78.4 to 104.4 the ride (see ride.ts): round the meadow in the car, low over the grass or high over the trees, the player driving;
//   104.4 to 107.6 home on the lawn, they step out into a line, hand in hand, the car lifts away, and the jackets light up gold;
//   from 111    they lift off one by one, a moment apart, and each flies a way of their own: not in a huddle, each one free.
// Each of the family has a place in the line, counted from the screen's left as the camera sees them: Daddy, Kai, Zora, Mama.
export const farewell = {
  appear: [2.6, 4.4],
  apart: 0.8,
  end: 119.5,
  fade: [8.2, 9.6],
  flare: [0.4, 2.8],
  flight: 7,
  hands: 107.6,
  hug: [3.4, 4.6],
  liftOff: 111,
  portrait: 6.2,
  ride: [78.4, 104.4],
  shine: [108.2, 110.2],
  show: [16.4, 76.4],
  turn: [2.4, 3.6],
  walk: [9.6, 16.4],
} as const;

// How much of the stage there is (0 to 1): it fades in as the family dances to it, and out once the show is over.
export const stageShown = (since: number): number =>
  ease(farewell.walk[1] - 3, farewell.walk[1], since) *
  (1 - ease(farewell.show[1], farewell.show[1] + 1, since));
export const flightHeight = 20;

export const ease = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// How brightly the third strand flares as it lights fully (0 to 1, and back to its steady gold).
export const flareOf = (ending: Ending): number =>
  ending.kind !== "lit"
    ? 0
    : Math.sin(
        Math.PI * ease(farewell.flare[0], farewell.flare[1], ending.since),
      );

// What one of the family is doing in the farewell, and where.
export type Doing =
  "dance" | "fly" | "hands" | "hug" | "ride" | "sing" | "stand";

export interface Place {
  readonly at: Vector3;
  readonly doing: Doing;
  // The way they face, as a yaw (0 faces +z, the tree; pi faces the front door, and the camera).
  readonly yaw: number;
}

// Across the screen: +x is the screen's left as the camera looks in from the front door.
const across = (line: number): number => 1.5 - line;
// Where each stands at the tree, and in the hug: close, the children a little in front and the grown-ups behind them, so the arms
// that hold them go behind them.
const atTree = (line: number): Vector3 =>
  new Vector3(across(line) * 0.95, 0, 4.4);
const hugged = [
  new Vector3(0.72, 0, 4.22),
  new Vector3(0.3, 0, 3.98),
  new Vector3(-0.06, 0, 3.84),
  new Vector3(-0.46, 0, 4.2),
];
const hugAt = (line: number): Vector3 => (hugged[line] ?? atTree(line)).clone();
// Who dances out first: Zora, then Kai, then Mama, then Daddy.
const outOrder = [3, 1, 0, 2];
// Where each stands in the line on the lawn: as far apart as their hands reach, so the hands they hold meet.
const lawn = [1.37, 0.33, -0.53, -1.37];
const lawnAt = (line: number): number => lawn[line] ?? across(line);
// Where the held hands meet, from the screen's left, and how high.
export const handsMeet = [
  new Vector3(0.92, 0.98, -5),
  new Vector3(-0.07, 0.72, -5),
  new Vector3(-1.03, 0.93, -5),
];

// One's own way out: from the hug, through the front door, across the lawn and up the stage's back steps to where they sing.
function wayOut(line: number, t: number): Vector3 {
  const x = across(line);
  const points = [
    hugAt(line),
    new Vector3(x * 0.25, 0, 1.6),
    new Vector3(x * 0.12, 0, -1.2),
    new Vector3(lawnAt(line) * 0.65, 0, -3.6),
    new Vector3(singAt(line).x * 0.8, 0, stage.back + 0.6),
    singAt(line),
  ];
  const legs = points.length - 1;
  const at = Math.max(0, Math.min(legs - 1e-6, t * legs));
  const leg = Math.floor(at);
  const from = points[leg] ?? hugAt(line);
  const to = points[leg + 1] ?? from;
  return from.clone().lerp(to, at - leg);
}

const liftOffOf = (line: number): number =>
  farewell.liftOff + line * farewell.apart;

// Where one of the family (by their place in the line) is in the farewell, and what they are doing, before any flight.
export function placeIn(since: number, line: number): Place {
  if (since < farewell.hug[0]) {
    // At the tree, facing it; then turned round to face the screen, one after another.
    const turned = since >= farewell.turn[0] + line * 0.25;
    return { at: atTree(line), doing: "stand", yaw: turned ? Math.PI : 0 };
  }
  if (since < farewell.walk[0]) {
    const close = ease(farewell.hug[0], farewell.hug[1], since);
    const at = atTree(line).lerp(hugAt(line), close);
    return { at, doing: "hug", yaw: Math.PI };
  }
  if (since < farewell.walk[1]) {
    // Dancing out, one after another.
    const [start, end] = farewell.walk;
    const rank = outOrder[line] ?? line;
    const t = ease(start + rank * 0.5, end - (3 - rank) * 0.5, since);
    return { at: wayOut(line, t), doing: "dance", yaw: Math.PI };
  }
  if (since < farewell.show[1])
    return { at: singAt(line), doing: "sing", yaw: Math.PI };
  if (since < farewell.hands) {
    // Down off the stage and into the car; the ride (the car carries them: see ride.ts); then out of it into the line on the lawn.
    const line0 = new Vector3(lawnAt(line), 0, -5);
    const seat = seatOf(home, line);
    const inCar = new Vector3(seat.x, 0, seat.z);
    if (since < farewell.ride[0]) {
      const down = ease(farewell.show[1], farewell.ride[0], since);
      return {
        at: singAt(line).lerp(inCar, down),
        doing: "dance",
        yaw: Math.PI,
      };
    }
    if (since < farewell.ride[1] + 0.4)
      return { at: inCar, doing: "ride", yaw: Math.PI };
    const out = ease(farewell.ride[1] + 0.4, farewell.hands, since);
    return { at: inCar.lerp(line0, out), doing: "dance", yaw: Math.PI };
  }
  // Hand in hand in a line on the lawn, facing out over the meadow (and the camera).
  return {
    at: new Vector3(lawnAt(line), 0, -5),
    doing: since >= liftOffOf(line) ? "fly" : "hands",
    yaw: Math.PI,
  };
}

const flown = (ending: Ending, line: number): number =>
  ending.kind !== "lit"
    ? 0
    : Math.max(
        0,
        Math.min(1, (ending.since - liftOffOf(line)) / farewell.flight),
      );

// How high one of the family has flown.
export function flight(ending: Ending, line = 0): number {
  const t = flown(ending, line);
  return t * t * flightHeight;
}

// Which way one of the family flies: up and back over the lit house, the four ways fanned out as they stood.
export const flightWay = (line: number): number => across(line) * 0.6;

// How far one of the family has flown from where they stood: up, and out along their own way, swaying a little as they go.
export function flownFrom(ending: Ending, line: number, time: number): Vector3 {
  const t = flown(ending, line);
  if (t === 0) return new Vector3();
  const way = flightWay(line);
  const out = t * t * 9;
  return new Vector3(
    Math.sin(way) * out + Math.sin(time * 1.7 + line) * 0.25 * t,
    t * t * flightHeight + Math.sin(time * 2.3 + line * 2) * 0.12 * t,
    Math.cos(way) * out,
  );
}

// A shot of the farewell: the camera stands `distance` before the anchor (toward the front door) and `height` up, and looks at `look`.
export interface Framing {
  readonly anchor: Vector3;
  readonly distance: number;
  readonly fov: number;
  readonly height: number;
  readonly look: Vector3;
}

// The farewell's shots: from behind the family at the tree as the strand lights; a family portrait for the hug, the ancestors and the
// lit tree behind; ahead of them out of the door as they dance, keeping them whole; close along the line of joined hands as the jackets
// light; then back and low, looking up as they rise. `lift` is how high the car carries them on the ride.
export function farewellShot(
  since: number,
  middle: Vector3,
  lift = 0,
): Framing {
  if (since < farewell.hug[0])
    return {
      anchor: new Vector3(0, 0, 6),
      distance: 5.6 - ease(0, farewell.hug[0], since) * 0.5,
      fov: 50,
      height: 1.5,
      look: new Vector3(0, 2.1, 5.8),
    };
  if (since < farewell.walk[0])
    return {
      anchor: new Vector3(0, 0, 4),
      distance: 3.3,
      fov: 46,
      height: 1.25,
      look: new Vector3(0, 1.55, 4.6),
    };
  if (since >= farewell.show[1] + 0.8 && since < farewell.ride[1] + 0.6)
    // The ride: behind and above the car wherever it goes, lifting as it lifts.
    return {
      anchor: middle.clone().setY(0),
      distance: 8.5 + lift * 0.5,
      fov: 54,
      height: 3.4 + lift * 0.7,
      look: middle.clone().setY(1.1 + lift * 0.9),
    };
  if (since >= farewell.walk[1] + 1.5 && since < farewell.show[1] + 0.8)
    // The show: back and up on the hillside, the whole stage in, drifting a little with the music.
    return {
      anchor: new Vector3(0, 0, -8.9),
      distance: 7,
      fov: 52,
      height: 3,
      look: new Vector3(Math.sin(since * 0.25) * 0.5, 1.9, -8.2),
    };
  if (since < farewell.hands) {
    // Ahead of them through the hall; once they are out of the door, back and up, so the whole line of dancers is seen at once.
    const out = ease(farewell.walk[0] + 2.4, farewell.walk[0] + 4, since);
    return {
      anchor: middle.clone(),
      distance: 4.2 + out * 2,
      fov: 48 - out * 2,
      height: 1.1 + out * 1.3,
      look: middle.clone().add(new Vector3(0, 1 - out * 0.1, 0)),
    };
  }
  const close = farewell.liftOff - 0.6;
  if (since < close) {
    // Along the held hands, one pair after another.
    const along = ease(farewell.hands, close, since) * (handsMeet.length - 1);
    const pair = Math.min(handsMeet.length - 2, Math.floor(along));
    const from = handsMeet[pair] ?? new Vector3();
    const meet = from.clone().lerp(handsMeet[pair + 1] ?? from, along - pair);
    return {
      anchor: new Vector3(meet.x, 0, -5),
      distance: 1.75,
      fov: 42,
      height: 1.05,
      look: new Vector3(meet.x, meet.y * 0.5 + 0.55, -5),
    };
  }
  const rising = flight({ kind: "lit", since }, 0);
  return {
    anchor: new Vector3(0, 0, -5),
    distance: 6,
    fov: 52,
    height: 0.7,
    look: new Vector3(0, 1.3 + rising * 0.6, -5),
  };
}
