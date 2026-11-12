import type { Mesh } from "three";
import { describe, expect, it, vi } from "vitest";

import type { Hands } from "../src/page/controls.ts";
import { endingMs, rideMs } from "../src/page/ending.ts";
import { createStageHands } from "../src/page/stage-hands.ts";
import { hillHint } from "../src/script/prompts.ts";
import { farewell, farewellShot, placeIn } from "../src/view/farewell.ts";
import {
  carSeats,
  cruise,
  home,
  inRange,
  range,
  rideIn,
  seatOf,
} from "../src/view/ride.ts";
import {
  breach,
  breachAt,
  buildBurrow,
  burrowAt,
  mound,
} from "../src/view/world/burrow.ts";
import { buildCar } from "../src/view/world/car.ts";
import { crownAt } from "../src/view/world/house-outside.ts";
import { pebble, roundPlan } from "../src/view/world/shapes.ts";
import { led } from "./support/states.ts";

const handsOf = (): Hands => ({
  act: vi.fn(),
  cards: vi.fn(),
  choose: vi.fn(),
  choosing: () => false,
  end: vi.fn(),
  inMoment: () => false,
  jump: vi.fn(),
  pause: vi.fn(),
  practise: vi.fn(),
  running: () => false,
  start: vi.fn(),
  steer: vi.fn(),
  turn: vi.fn(),
  vision: vi.fn(),
});
const [start, end] = farewell.ride;

describe("the hover car after the show", () => {
  it("comes as the show ends, waits on the lawn, cruises by itself, comes home and lifts away", () => {
    expect(rideIn(farewell.show[1] - 1, null)).toBeNull();
    const waiting = rideIn(start - 0.5, null);
    expect(waiting).toMatchObject({ ...home, aboard: false });
    expect(waiting?.shown).toBeGreaterThan(0.5);
    // Out over the meadow, inside its hedge, off the ground, the family aboard.
    for (let since = start + 4; since < end - 4; since += 1.7) {
      const at = rideIn(since, null);
      expect(at?.aboard).toBe(true);
      expect(inRange(at?.x ?? 99, at?.z ?? 99)).toEqual({ x: at?.x, z: at?.z });
      expect(at?.high).toBeGreaterThan(home.high);
    }
    expect(cruise(0)).toMatchObject({ high: home.high, x: home.x, z: home.z });
    // Wherever the player has driven it, it is home on the lawn when the ride ends.
    const far = { high: 6, x: 12, yaw: 0.4, z: -20 };
    expect(rideIn(start + 8, far)).toMatchObject(far);
    const back = rideIn(end, far);
    expect(back?.x).toBeCloseTo(home.x);
    expect(back?.z).toBeCloseTo(home.z);
    expect(back?.high).toBeCloseTo(home.high);
    expect(Math.cos((back?.yaw ?? 0) - home.yaw)).toBeCloseTo(1);
    const gone = rideIn(farewell.hands + 2, null);
    expect(gone?.shown).toBe(0);
    expect(gone?.high).toBeGreaterThan(5);
  });

  it("seats the children in front and the grown-ups behind, wherever it points", () => {
    expect(seatOf(home, 1).z).toBeLessThan(seatOf(home, 0).z);
    const turned = seatOf({ ...home, yaw: 0 }, 1);
    expect(turned.x).toBeCloseTo(home.x + (carSeats[1]?.across ?? 0));
    expect(turned.z).toBeCloseTo(home.z + (carSeats[1]?.along ?? 0));
    expect(seatOf(home, 9)).toEqual(seatOf(home, 0));
    expect(inRange(99, 99)).toEqual({ x: range.east, z: range.south });
    expect(inRange(-99, -99)).toEqual({ x: -range.east, z: range.north });
  });

  it("carries the family through the farewell: into it, round, and out to the line", () => {
    expect(placeIn(farewell.show[1] + 1, 2).doing).toBe("dance");
    expect(placeIn(start + 5, 2)).toMatchObject({ doing: "ride" });
    expect(placeIn(end + 1.5, 2).doing).toBe("dance");
    expect(placeIn(farewell.hands + 0.1, 2).doing).toBe("hands");
    const low = farewellShot(start + 5, placeIn(start + 5, 0).at, 0);
    const high = farewellShot(start + 5, placeIn(start + 5, 0).at, 5);
    expect(high.height).toBeGreaterThan(low.height);
    expect(high.look.y).toBeGreaterThan(low.look.y);
    expect(endingMs.lit).toBe(Math.round(farewell.end * 1000));
    expect(rideMs).toEqual([start * 1000, (start + 12) * 1000]);
  });

  it("is driven by the player's hands once they take it, and lifted by a jump or the act key", () => {
    let clock = 0;
    const show = createStageHands(
      () => true,
      () => clock,
    );
    const hands = handsOf();
    const keys = show.wrap(hands, false);
    show.begin("kai");
    clock = (start + 6) * 1000;
    // Left alone, it cruises: the page has nowhere to tell the view.
    expect(show.frame(clock)?.ride).toBeNull();
    keys.steer({ x: 1, y: 0 }, false);
    show.frame(clock);
    const from = show.frame((clock += 100))?.ride;
    for (let frame = 0; frame < 30; frame += 1) show.frame((clock += 100));
    const driven = show.frame((clock += 100))?.ride;
    // Right on the screen is -x; and it turns to point the way it goes.
    expect(driven?.x).toBeLessThan((from?.x ?? 0) - 5);
    expect(Math.sin(driven?.yaw ?? 0)).toBeLessThan(-0.9);
    // A lift, and another, never over the top; left alone it sinks again and glides to a stop.
    keys.jump();
    keys.act(true);
    keys.act(false);
    const lifted = show.frame((clock += 16))?.ride;
    expect(lifted?.high).toBeGreaterThan((driven?.high ?? 0) + 2.5);
    for (let lift = 0; lift < 9; lift += 1) keys.jump();
    expect(show.frame((clock += 16))?.ride?.high).toBeLessThanOrEqual(
      range.top,
    );
    keys.steer(null, false);
    for (let frame = 0; frame < 40; frame += 1) show.frame((clock += 100));
    const stopped = show.frame((clock += 100))?.ride;
    const later = show.frame((clock += 100))?.ride;
    expect(later?.x).toBeCloseTo(stopped?.x ?? 99, 1);
    expect(later?.high).toBeLessThan(range.top);
    expect(hands.jump).not.toHaveBeenCalled();
    // It keeps to the meadow however long it is pushed.
    keys.steer({ x: -1, y: -1 }, false);
    for (let frame = 0; frame < 80; frame += 1) show.frame((clock += 100));
    expect(show.frame(clock)?.ride?.x).toBeLessThanOrEqual(range.east);
    // A lift before anyone has steered takes it from its cruise; a new ending starts it again.
    show.begin("zora");
    const again = createStageHands(
      () => true,
      () => clock,
    );
    again.begin("zora");
    clock += (start + 5) * 1000;
    again.wrap(handsOf(), true).act(true);
    expect(again.frame(clock)?.ride?.high).toBeGreaterThan(home.high + 1);
  });

  it("is a pod of curves that grows out of a point of light where it is", () => {
    const car = buildCar({ value: 1 });
    car.update(null, 0, 0);
    expect(car.group.visible).toBe(false);
    car.update({ ...home, aboard: true, shown: 1, x: 3, z: -9 }, 0.2, 1);
    expect(car.group.visible).toBe(true);
    expect(car.group.position.x).toBe(3);
    expect(car.group.position.y).toBeGreaterThan(0.5);
    expect(car.group.rotation.y).toBe(home.yaw);
    car.update({ ...home, aboard: false, shown: 0 }, 0, 2);
    expect(car.group.visible).toBe(false);
  });
});

describe("the giant snake under the meadow", () => {
  it("goes round a figure of eight inside the hedge, and its back shows only now and then", () => {
    for (let along = 0; along < 7; along += 0.2) {
      const at = burrowAt(along);
      expect(Math.abs(at.x)).toBeLessThan(13);
      expect(at.z).toBeLessThan(-5);
      expect(at.z).toBeGreaterThan(-22);
    }
    expect(breachAt(0)).toBe(0);
    expect(breachAt(breach.lasts / 2)).toBeCloseTo(1);
    expect(breachAt(breach.lasts + 1)).toBe(0);
    expect(breachAt(-breach.every + breach.lasts / 2)).toBeCloseTo(1);
  });

  it("is a ridge, a loop of back and a mound, until it rises and the mound falls away", () => {
    const burrow = buildBurrow({ value: 0.2 });
    const [ridge, back, pile, light] = burrow.group.children as Mesh[];
    // A time when its back is out and it is away from the hill.
    const out = [...Array(200).keys()]
      .map((step) => step * 0.5)
      .find((time) => {
        burrow.update(true, 0, time, false);
        return back?.visible === true;
      });
    expect(out).toBeDefined();
    expect(ridge?.visible).toBe(true);
    expect(pile?.visible).toBe(true);
    expect(pile?.scale.y).toBeGreaterThan(mound.high * 0.9);
    burrow.update(true, 0, out ?? 0, true);
    expect(
      (light as unknown as { material: { opacity: number } }).material.opacity,
    ).toBeGreaterThan(0.3);
    // The finale: nothing under the ground any more, and the mound gone as it comes up.
    burrow.update(false, 0.5, 3, true);
    expect(ridge?.visible).toBe(false);
    expect(back?.visible).toBe(false);
    expect(pile?.scale.y).toBeCloseTo(mound.high * 0.5, 0);
    burrow.update(false, 1, 4, false);
    expect(pile?.visible).toBe(false);
  });

  it("is only hinted at on the hill, until the family can wake it", () => {
    const by = { x: 0, z: -11_500 };
    expect(hillHint(led({ ...by, jackets: false }))).toContain("jackets");
    expect(hillHint(led({ ...by, jackets: true, party: [] }))).toContain(
      "whole family",
    );
    expect(hillHint(led({ x: 0, z: 5_000 }))).toBeNull();
  });
});

describe("the house of curves", () => {
  it("has a roof like a wave: tall over the east wing, low by the door, down to the ground at each end", () => {
    expect(crownAt(11)).toBeGreaterThan(crownAt(0) + 1.5);
    expect(crownAt(-8)).toBeGreaterThan(crownAt(0) + 0.5);
    expect(crownAt(0)).toBeGreaterThan(5);
    expect(crownAt(13.6)).toBeCloseTo(0);
    expect(crownAt(-14)).toBe(0);
  });

  it("builds every block as a pebble, rounded whichever way it is thin, and rounds a wall's ends", () => {
    for (const size of [
      [1.2, 0.1, 0.8],
      [0.1, 1.2, 0.8],
      [1.2, 0.8, 0.1],
    ] as const) {
      const made = pebble(size[0], size[1], size[2]);
      made.computeBoundingBox();
      const box = made.boundingBox;
      expect((box?.max.x ?? 0) - (box?.min.x ?? 0)).toBeCloseTo(size[0], 1);
      expect((box?.max.y ?? 0) - (box?.min.y ?? 0)).toBeCloseTo(size[1], 1);
      expect((box?.max.z ?? 0) - (box?.min.z ?? 0)).toBeCloseTo(size[2], 1);
      expect(pebble(size[0], size[1], size[2])).toBe(made);
    }
    const plan = roundPlan(0, 0, 4, 0.2, 0.1);
    expect(plan.every(([x, z]) => x >= 0 && x <= 4 && z >= 0 && z <= 0.2)).toBe(
      true,
    );
    // No point of it is a corner of the rectangle.
    expect(
      plan.some(([x, z]) => (x === 0 || x === 4) && (z === 0 || z === 0.2)),
    ).toBe(false);
  });
});
