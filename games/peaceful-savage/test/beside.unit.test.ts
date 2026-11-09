import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { heroIds } from "../src/rules/constants.ts";
import { walls } from "../src/rules/layout.ts";
import { besideLead, placeWith, walkingPlaces } from "../src/view/beside.ts";

// The lead in the open meadow, facing north (-z, a yaw of pi): their left, and the screen's left as the camera follows, is -x.
const meadow = new Vector3(4, 0, -12);
const at = (hero: "ali" | "heerah" | "zora") => {
  const place = besideLead(meadow, Math.PI, placeWith("kai", hero));
  if (place === null) throw new Error("no room in the open meadow");
  return place;
};

describe("the found walking with the lead", () => {
  it("with Kai leading: Zora close behind at his left, Mama beside her further left, Daddy close on his right", () => {
    const zora = at("zora");
    const mama = at("heerah");
    const daddy = at("ali");
    expect(zora.x).toBeLessThan(meadow.x);
    expect(mama.x).toBeLessThan(zora.x - 0.4);
    expect(daddy.x).toBeGreaterThan(meadow.x + 0.5);
    for (const place of [zora, mama, daddy]) {
      const offset = place.clone().sub(meadow);
      // Close, and never trailing: more beside than behind.
      expect(offset.length()).toBeLessThan(1.4);
      expect(offset.z).toBeGreaterThanOrEqual(0);
      expect(offset.z).toBeLessThan(0.6);
      expect(Math.abs(offset.x)).toBeGreaterThan(offset.z);
    }
    expect(Math.abs(mama.distanceTo(zora) - 0.59)).toBeLessThan(0.05);
  });

  it("gives every lead the same shape, with a place for each of the other three", () => {
    for (const lead of heroIds) {
      const places = heroIds
        .filter((hero) => hero !== lead)
        .map((hero) => placeWith(lead, hero))
        .sort();
      expect(places).toEqual([0, 1, 2]);
      expect(placeWith(lead, lead)).toBe(-1);
    }
    expect(besideLead(meadow, Math.PI, 3)).toBeNull();
  });

  it("take the other side where a wall stands at one, or else close behind, and only where neither is clear none", () => {
    // A long wall, and the lead just beside it facing +z, so their left is toward the wall: Zora's place goes to the right.
    const wall = walls.find(
      (box) => box.x1 - box.x0 >= 100 && box.z1 - box.z0 >= 1_500,
    );
    if (wall === undefined) throw new Error("no long wall");
    const lead = new Vector3(
      wall.x0 / 1000 - 0.45,
      0,
      (wall.z0 + wall.z1) / 2000,
    );
    expect(besideLead(lead, 0, 0)?.x).toBeLessThan(lead.x);
    // In the front doorway, facing out: the frame is close at both sides, so Daddy walks close behind.
    const behind = besideLead(new Vector3(0, 0, 0), Math.PI, 2);
    expect(behind?.x).toBeCloseTo(0);
    expect(behind?.z).toBeGreaterThan(0.6);
    expect(behind?.z).toBeLessThan(1.6);
    // Inside a wall there is no place at all.
    const inside = new Vector3(
      (wall.x0 + wall.x1) / 2000,
      0,
      (wall.z0 + wall.z1) / 2000,
    );
    expect(besideLead(inside, 0, 0)).toBeNull();
  });

  it("settles the three together, so one moved to the other side never lands on another", () => {
    const wall = walls.find(
      (box) => box.x1 - box.x0 >= 100 && box.z1 - box.z0 >= 1_500,
    );
    if (wall === undefined) throw new Error("no long wall");
    const lead = new Vector3(
      wall.x0 / 1000 - 0.45,
      0,
      (wall.z0 + wall.z1) / 2000,
    );
    const placed = walkingPlaces("kai", lead, 0, [
      "ali",
      "kai",
      "zora",
      "heerah",
    ]);
    expect(placed.has("kai")).toBe(false);
    const spots = [...placed.values()].filter((one) => one !== null);
    expect(spots.length).toBeGreaterThanOrEqual(2);
    for (const [index, one] of spots.entries())
      for (const other of spots.slice(index + 1))
        expect(one.distanceTo(other)).toBeGreaterThan(0.5);
  });
});
