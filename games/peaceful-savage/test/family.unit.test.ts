import { Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { heroIds } from "../src/rules/constants.ts";
import type { PlayState } from "../src/rules/types.ts";
import { buildFamily, type Family } from "../src/view/family.ts";
import { lineOf } from "../src/view/family-farewell.ts";
import { farewell, placeIn } from "../src/view/farewell.ts";
import { timelineOf } from "./support/timeline.ts";

let lit: PlayState;
let family: Family;

// Plays the farewell up to `until` seconds, a tenth of a second a frame, from the start.
function playTo(until: number): void {
  for (let since = 0; since <= until; since += 0.1)
    family.update({
      alpha: 1,
      camera: new Vector3(0, 1.2, 0.7),
      dt: 0.1,
      ending: { kind: "lit", since },
      lookAt: null,
      previous: lit,
      select: "zora",
      state: lit,
      time: since,
    });
}

type Hero = (typeof heroIds)[number];
// Where each stands in the hug, and where their face is.
const at = (hero: Hero): Vector3 => placeIn(farewell.portrait, lineOf[hero]).at;
const headOf = (hero: Hero): Vector3 =>
  at(hero).add(new Vector3(0, family.characters[hero].height * 0.9, 0));

// Whether a hand, seen from the hug's camera, is in front of a face.
const camera = new Vector3(0, 1.25, 0.7);
function blocks(hand: Vector3, face: Vector3, radius: number): boolean {
  const toFace = face.clone().sub(camera);
  const way = toFace.clone().normalize();
  const toHand = hand.clone().sub(camera);
  const along = toHand.dot(way);
  if (along >= toFace.length() - radius) return false;
  const off = toHand.sub(way.multiplyScalar(along)).length();
  return off < (radius * along) / toFace.length() + 0.04;
}

beforeAll(() => {
  const states = timelineOf("zora", 45);
  const last = states.at(-1);
  if (last === undefined || last.cause !== "lit") throw new Error("no lit run");
  lit = last;
  family = buildFamily(1, 0.2);
});

describe("the family's big hug at the end", () => {
  it("has Zora hold Sparky in the middle, below every face", () => {
    playTo(farewell.portrait);
    const sparky = family.played()?.sparky;
    if (sparky === null || sparky === undefined)
      throw new Error("Sparky is not held");
    const zora = family.characters.zora;
    const hands = zora.hand("L").lerp(zora.hand("R"), 0.5);
    expect(sparky.distanceTo(hands)).toBeLessThan(0.2);
    for (const hero of heroIds)
      expect(sparky.y).toBeLessThan(headOf(hero).y - 0.2);
    // In the middle of the four.
    expect(Math.abs(sparky.x - family.middle().x)).toBeLessThan(0.3);
  });

  it("puts the parents' arms behind the children, and Kai's behind his sister, with no hand before a face", () => {
    playTo(farewell.portrait);
    const { ali, heerah, kai, zora } = family.characters;
    // Behind is further from the camera (larger z) than the child's middle.
    expect(ali.hand("L").z).toBeGreaterThan(at("kai").z);
    expect(heerah.hand("R").z).toBeGreaterThan(at("zora").z);
    expect(kai.hand("L").z).toBeGreaterThan(at("zora").z);
    // Seen from the camera, no hand is in front of a face (a face is a ball a little smaller than the head; a hand, a ball 4cm round).
    for (const hero of heroIds)
      for (const hand of [
        family.characters[hero].hand("L"),
        family.characters[hero].hand("R"),
      ])
        for (const face of heroIds) {
          const radius = family.characters[face].height * 0.07;
          expect(blocks(hand, headOf(face), radius)).toBe(false);
          expect(hand.distanceTo(headOf(face))).toBeGreaterThan(radius);
        }
    // The hands laid on shoulders rest there: Daddy's on Kai's, Kai's on his sister's far one, and Mama's over Kai's.
    expect(ali.hand("L").distanceTo(kai.joint("shoulderR"))).toBeLessThan(0.12);
    expect(kai.hand("L").distanceTo(zora.joint("shoulderL"))).toBeLessThan(0.1);
    expect(heerah.hand("R").distanceTo(kai.hand("L"))).toBeLessThan(0.12);
    expect(zora.hand("L").y).toBeLessThan(headOf("zora").y - 0.25);
  });

  it("holds hands on the lawn: each held pair of hands meets, the grown-ups' reaching down and the children's up", () => {
    playTo(farewell.hands + 1.5);
    const { ali, heerah, kai, zora } = family.characters;
    for (const [left, right] of [
      [ali.hand("L"), kai.hand("R")],
      [kai.hand("L"), zora.hand("R")],
      [zora.hand("L"), heerah.hand("R")],
    ] as const)
      expect(left.distanceTo(right)).toBeLessThan(0.2);
  });

  it("lets Sparky dance above them on the way out, and ride back at the lead's shoulder for the flight", () => {
    playTo(12);
    const above = family.played()?.sparky;
    expect(above?.y).toBeGreaterThan(1.9);
    playTo(farewell.liftOff + 1);
    expect(family.played()?.sparky ?? null).toBeNull();
  });
});
