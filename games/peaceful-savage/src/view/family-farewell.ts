import { Vector3 } from "three";

import { type HeroId, heroIds } from "../rules/constants.ts";
import type { Acting } from "./acting.ts";
import type { Character } from "./body/character.ts";
import {
  dance,
  holdHands,
  idle,
  portraitHug,
  sit,
  soar,
} from "./body/poses.ts";
import type { FamilyFrame, Placed } from "./family.ts";
import {
  type Doing,
  ease,
  farewell,
  flightWay,
  flownFrom,
  placeIn,
  stageShown,
} from "./farewell.ts";
import { carFloor, carSeats, rideIn, type Riding, seatOf } from "./ride.ts";
import { onStage, type StageControl, stageLift } from "./show.ts";
import { groundAt } from "./world/meadow.ts";

// The family in the farewell, once the tree is lit: everyone where the farewell has them (see farewell.ts), doing what it has them do,
// and up into the air once they lift off.

// Each one's place in the line, from the screen's left: Daddy, Kai, Zora, Mama.
export const lineOf: Readonly<Record<HeroId, number>> = {
  ali: 0,
  heerah: 3,
  kai: 1,
  zora: 2,
};

export type Move = (
  hero: HeroId,
  to: Vector3,
  yaw: number,
  acting: Acting,
  frame: FamilyFrame,
  how: "ease" | "snap",
  more?: {
    readonly ground?: (x: number, z: number) => number;
    readonly still?: boolean;
  },
) => Placed;

const flying: Acting = { arms: true, expression: "smile", pose: soar };

function actingOf(
  hero: HeroId,
  doing: Doing,
  since: number,
  time: number,
  legs: number,
): Acting {
  const line = lineOf[hero];
  switch (doing) {
    case "dance":
      return {
        arms: true,
        expression: "smile",
        pose: dance(since * 1.1 + line * 0.25, hero === "zora"),
      };
    case "hug":
      return { arms: true, expression: "smile", pose: portraitHug(line) };
    case "hands":
      return { arms: true, expression: "smile", pose: holdHands(line) };
    case "fly":
      return flying;
    case "ride":
      // Sat in the car, waving now and then as it goes.
      return {
        arms: true,
        expression: Math.sin(since * 0.9 + line * 2) > 0.6 ? "open" : "smile",
        pose: sit(legs, carSeats[line]?.high ?? 0.4),
      };
    case "stand":
      return { arms: false, expression: "smile", pose: idle(hero, time, true) };
    case "sing": {
      // Singing to the screen: the mouth opens on the words, in time, and the body dances.
      const beat = Math.floor((since - farewell.show[0]) / 0.3 + line) % 4;
      return {
        arms: true,
        expression: beat === 0 || beat === 2 ? "open" : "smile",
        pose: dance(since * 0.9 + line * 0.4, hero === "zora"),
      };
    }
  }
}

// Where the player has moved one of the family on the stage, from where they sing; and a big move (a spin and a jump, 0.9 seconds).
const movedOn = (
  stage: StageControl | null | undefined,
  hero: HeroId,
): Vector3 => {
  const moved = stage?.at[hero];
  return moved === undefined ? new Vector3() : new Vector3(moved.x, 0, moved.z);
};
const bigMove = (
  stage: StageControl | null | undefined,
  hero: HeroId,
  now: number,
): number =>
  stage?.who === hero
    ? Math.max(0, Math.min(1, (now - stage.moveAt) / 900))
    : 1;

// Where Sparky is in the farewell: held in Zora's cupped hands in the middle of the hug, then dancing above the family as they go out
// and over the line of them on the lawn; null leaves him at the lead's shoulder.
function sparkyIn(
  since: number,
  zora: Character,
  middle: Vector3,
): Vector3 | null {
  if (since >= farewell.hug[0] + 0.6 && since < farewell.walk[0])
    return zora
      .hand("L")
      .lerp(zora.hand("R"), 0.5)
      .add(new Vector3(0, 0.07, -0.1));
  if (since >= farewell.walk[0] && since < farewell.liftOff)
    return middle
      .clone()
      .add(
        new Vector3(
          Math.sin(since * 2.2) * 0.3,
          2.1 + stageShown(since) * 0.8 + Math.sin(since * 4.4) * 0.12,
          0,
        ),
      );
  return null;
}

// The hug's arms, laid exactly, nothing across a face: Daddy's hand on Kai's shoulder from behind; Kai's arm behind his sister, his hand
// on her far shoulder; and Mama's hand over Kai's there, on Zora's shoulder. Each comes in as the hug closes.
function embrace(
  since: number,
  characters: Readonly<Record<HeroId, Character>>,
): void {
  const weight = ease(farewell.hug[0] + 0.3, farewell.hug[1] + 0.2, since);
  if (weight <= 0 || since >= farewell.walk[0]) return;
  const { ali, heerah, kai, zora } = characters;
  const lay = (who: Character, side: "L" | "R", on: Vector3, pole: Vector3) =>
    who.reach(side, who.hand(side).lerp(on, weight), pole);
  // A hand rests on a shoulder from behind: the wrist a little above the joint and behind it.
  const onShoulder = (who: Character, side: "L" | "R") =>
    who
      .joint(`shoulder${side}`)
      .add(new Vector3(0, who.height * 0.035, who.height * 0.03));
  lay(ali, "L", onShoulder(kai, "R"), downBehind);
  lay(kai, "L", onShoulder(zora, "L"), lowBehind);
  lay(heerah, "R", kai.hand("L").add(new Vector3(0, 0.04, 0.025)), downBehind);
}
const downBehind = new Vector3(0, -1, 0.6);
const lowBehind = new Vector3(0, -1, 0.9);

export interface Played {
  // The hover car after the show, where it is (null before it comes).
  readonly car: Riding | null;
  // Where the lead is, and where Sparky should be (null for the lead's shoulder).
  readonly lead: Placed | null;
  // Where the one the player moves on the stage stands, for the ring under them (null when nobody is moved).
  readonly marked: Vector3 | null;
  readonly sparky: Vector3 | null;
}

// Plays the farewell's frame for all four.
export function playFarewell(
  lead: HeroId,
  frame: FamilyFrame,
  characters: Readonly<Record<HeroId, Character>>,
  move: Move,
): Played {
  const { since } = frame.ending;
  let leadPlaced: Placed | null = null;
  let marked: Vector3 | null = null;
  const middle = new Vector3();
  const shown = stageShown(since);
  const showing = since >= farewell.walk[1] && since < farewell.show[1];
  const control = showing ? frame.stage : null;
  // The hover car after the show: where the player has driven it, or its own cruise.
  const car = rideIn(since, frame.stage?.ride ?? null);
  const under = car === null ? 0 : groundAt(car.x, car.z);
  for (const hero of heroIds) {
    const line = lineOf[hero];
    const place = placeIn(since, line);
    const riding = place.doing === "ride" && car !== null;
    // On the stage, where the player has moved them; the one they move dances as they walk. In the car, on their own seat.
    const to = place.at.clone().add(movedOn(control, hero));
    const kept = onStage(to.x, to.z);
    if (showing) to.set(kept.x, 0, kept.z);
    if (riding) {
      const seat = seatOf(car, line);
      to.set(seat.x, 0, seat.z);
    }
    const walking = control?.who === hero && control.walking;
    const placed = move(
      hero,
      to,
      riding ? car.yaw : place.yaw,
      actingOf(
        hero,
        walking ? "dance" : place.doing,
        since,
        frame.time,
        characters[hero].legs,
      ),
      frame,
      since < 0.1 || riding ? "snap" : "ease",
      riding ? { ground: () => under, still: true } : undefined,
    );
    const flown = flownFrom(frame.ending, line, frame.time);
    const aloft = flown.y > 0.01;
    // Up on the stage, and up in a big move's jump.
    const spin = bigMove(control, hero, frame.time * 1000);
    const up = flown.add(
      new Vector3(
        0,
        stageLift(placed.at, groundAt, shown) +
          Math.sin(Math.PI * spin) * 0.45 +
          (riding ? car.high + carFloor : 0),
        0,
      ),
    );
    characters[hero].fly(
      up,
      aloft
        ? flightWay(line)
        : riding
          ? car.yaw
          : spin < 1
            ? Math.PI + spin * Math.PI * 2
            : null,
      aloft ? -0.3 * Math.min(1, up.y / 4) : 0,
    );
    if (control?.who === hero) marked = placed.at.clone().setY(up.y);
    if (hero === lead)
      leadPlaced = { ...placed, at: placed.at.clone().add(up) };
    middle.addScaledVector(placed.at, 1 / heroIds.length);
  }
  embrace(since, characters);
  if (car?.aboard === true) middle.y += car.high;
  return {
    car,
    lead: leadPlaced,
    marked,
    sparky: sparkyIn(since, characters.zora, middle),
  };
}
