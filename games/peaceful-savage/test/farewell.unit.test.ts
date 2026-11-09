import { afterEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";

import {
  concertMs,
  createEnding,
  drumsMs,
  endingMs,
} from "../src/page/ending.ts";
import {
  farewell,
  farewellShot,
  flareOf,
  placeIn,
} from "../src/view/farewell.ts";
import { singAt, stage } from "../src/view/show.ts";

const family = [0, 1, 2, 3];
const lit = (since: number) => ({ kind: "lit", since }) as const;

describe("the farewell once the tree is lit", () => {
  it("stands the family at the tree, facing it, as the third strand flares, then turns them round one by one to the screen", () => {
    for (const line of family) {
      const place = placeIn(1, line);
      expect(place.doing).toBe("stand");
      expect(place.at.z).toBeCloseTo(4.4);
      expect(place.yaw).toBe(0);
    }
    expect(flareOf(lit(0))).toBe(0);
    expect(flareOf(lit(1.6))).toBeGreaterThan(0.95);
    expect(flareOf(lit(farewell.flare[1]))).toBeCloseTo(0);
    expect(flareOf(lit(12))).toBeCloseTo(0);
    expect(flareOf({ kind: "grey", since: 1.6 })).toBe(0);
    expect(flareOf({ kind: null, since: 1.6 })).toBe(0);
    // Turned round one after another, as the strand settles.
    expect(placeIn(farewell.turn[0], 0).yaw).toBe(Math.PI);
    expect(placeIn(farewell.turn[0], 1).yaw).toBe(0);
    expect(placeIn(farewell.turn[0] + 0.75, 3).yaw).toBe(Math.PI);
    expect(farewell.turn[0]).toBeGreaterThan(farewell.flare[0]);
  });

  it("fades the ancestors in as they turn, and holds the big hug facing the screen for the picture before the ancestors fade", () => {
    expect(farewell.appear[0]).toBeGreaterThanOrEqual(farewell.turn[0]);
    expect(farewell.appear[1]).toBeLessThan(farewell.portrait);
    expect(farewell.hug[1]).toBeLessThan(farewell.portrait);
    expect(farewell.portrait).toBeLessThan(farewell.fade[0]);
    const hug = family.map((line) => placeIn(farewell.portrait, line));
    for (const place of hug) {
      expect(place.doing).toBe("hug");
      expect(place.yaw).toBe(Math.PI);
    }
    // The children stand a little in front (nearer the camera), Zora in front of Kai, so the arms round them go behind them.
    const [daddy, kai, zora, mama] = hug.map((place) => place.at.z);
    expect(Math.max(kai ?? 9, zora ?? 9)).toBeLessThan(
      Math.min(daddy ?? 0, mama ?? 0),
    );
    expect(zora).toBeLessThan(kai ?? 0);
    // Side by side from the screen's left (Daddy, Kai, Zora, Mama), close enough to hold on.
    for (const [line, place] of hug.entries()) {
      const next = hug[line + 1];
      if (next === undefined) continue;
      expect(place.at.x).toBeGreaterThan(next.at.x);
      expect(place.at.distanceTo(next.at)).toBeLessThan(0.6);
    }
    // Drawn in from where they stood, not snapped.
    const drawing = placeIn(farewell.hug[0] + 0.3, 0).at;
    expect(drawing.distanceTo(placeIn(1, 0).at)).toBeGreaterThan(0);
    expect(
      drawing.distanceTo(placeIn(farewell.portrait, 0).at),
    ).toBeGreaterThan(0);
  });

  it("dances them out through the front door, Zora first, up onto the stage to sing, then holds hands in a line on the lawn", () => {
    const zora = [10.5, 12.5, 14.5].map((since) => placeIn(since, 2));
    for (const place of zora) expect(place.doing).toBe("dance");
    const along = zora.map((place) => place.at.z);
    expect(along).toEqual([...along].sort((a, b) => b - a));
    const early = family.map((line) => placeIn(farewell.walk[0] + 1.5, line));
    const furthest = Math.min(...early.map((place) => place.at.z));
    expect(early[2]?.at.z).toBe(furthest);
    // The show: each sings at their microphone, facing the screen, from the screen's left.
    const singing = family.map((at) => placeIn(farewell.show[0] + 30, at));
    for (const [at, place] of singing.entries()) {
      expect(place.doing).toBe("sing");
      expect(place.yaw).toBe(Math.PI);
      expect(place.at.z).toBeLessThan(stage.back);
      expect(place.at.z).toBeGreaterThan(stage.front);
      expect(place.at.x).toBeCloseTo(singAt(at).x);
    }
    expect(farewell.show[1] - farewell.show[0]).toBeCloseTo(60);
    // Down off the stage after it.
    expect(placeIn(farewell.show[1] + 0.5, 0).doing).toBe("dance");
    const line = family.map((at) => placeIn(farewell.hands + 0.5, at));
    for (const [at, place] of line.entries()) {
      expect(place.doing).toBe("hands");
      expect(place.at.z).toBe(-5);
      const next = line[at + 1];
      if (next === undefined) continue;
      // From the screen's left, close enough for the hands to meet.
      expect(place.at.x - next.at.x).toBeGreaterThan(0.7);
      expect(place.at.x - next.at.x).toBeLessThan(1.1);
    }
  });

  it("lifts them off one by one, a moment apart", () => {
    const liftOff = farewell.liftOff;
    expect(placeIn(liftOff, 0).doing).toBe("fly");
    expect(placeIn(liftOff, 1).doing).toBe("hands");
    expect(placeIn(liftOff + farewell.apart, 1).doing).toBe("fly");
    expect(placeIn(liftOff + farewell.apart * 3 - 0.01, 3).doing).toBe("hands");
    expect(placeIn(liftOff + farewell.apart * 3, 3).doing).toBe("fly");
  });

  it("films the tree, the family portrait, the dance, the joined hands up close, then looks up as they rise", () => {
    const middle = new Vector3(0.4, 0, -2);
    expect(farewellShot(2, middle).anchor.z).toBe(6);
    const portrait = farewellShot(farewell.portrait, middle);
    expect(portrait.anchor.z).toBe(4);
    expect(portrait.look.y).toBeGreaterThan(1.2);
    const dancing = farewellShot(12, middle);
    expect(dancing.anchor).toEqual(middle);
    expect(dancing.look.y).toBeCloseTo(1);
    // The show: back and up on the hillside, the whole stage in.
    const show = farewellShot(farewell.show[0] + 10, middle);
    expect(show.distance).toBeGreaterThan(6);
    expect(show.anchor.z).toBeCloseTo(singAt(0).z);
    expect(show.height).toBeGreaterThan(2);
    const hands = [farewell.hands + 0.5, farewell.liftOff - 1].map((since) =>
      farewellShot(since, middle),
    );
    for (const shot of hands) {
      expect(shot.distance).toBeLessThan(2);
      expect(shot.anchor.z).toBe(-5);
    }
    expect(hands[1]?.anchor.x).toBeLessThan(hands[0]?.anchor.x ?? 0);
    const lifted = farewell.liftOff;
    const rising = farewellShot(lifted + 0.5, middle).look.y;
    expect(farewellShot(lifted + 4, middle).look.y).toBeGreaterThan(rising);
    expect(farewellShot(lifted + 4, middle).distance).toBeGreaterThan(4);
  });
});

describe("the end of a run, played out before the card", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the lit farewell with its drums and the show's music, then the card", () => {
    vi.useFakeTimers();
    const over = vi.fn();
    const drums = vi.fn();
    const ending = createEnding(over, drums);
    expect(ending.begin("lit")).toBe(true);
    vi.advanceTimersByTime(drumsMs - 1);
    expect(drums).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(drums).toHaveBeenCalledTimes(1);
    expect(drums).toHaveBeenLastCalledWith("drums");
    vi.advanceTimersByTime((concertMs.at(-1) ?? 0) - drumsMs);
    expect(drums).toHaveBeenCalledTimes(1 + concertMs.length);
    expect(drums).toHaveBeenLastCalledWith("concert");
    expect(concertMs).toHaveLength(5);
    vi.advanceTimersByTime(endingMs.lit - (concertMs.at(-1) ?? 0) - 1);
    expect(over).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(over).toHaveBeenCalledTimes(1);
  });

  it("takes a lead gone grey into the coil without drums, and skips what is left", () => {
    vi.useFakeTimers();
    const over = vi.fn();
    const drums = vi.fn();
    const ending = createEnding(over, drums);
    expect(ending.begin("grey")).toBe(true);
    vi.advanceTimersByTime(endingMs.grey);
    expect(over).toHaveBeenCalledTimes(1);
    expect(drums).not.toHaveBeenCalled();
    ending.begin("lit");
    ending.skip();
    expect(over).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(endingMs.lit);
    expect(over).toHaveBeenCalledTimes(2);
    expect(drums).not.toHaveBeenCalled();
  });

  it("goes straight to the card for a run the player ended, and forgets an ending begun before", () => {
    vi.useFakeTimers();
    const over = vi.fn();
    const ending = createEnding(over, vi.fn());
    ending.begin("grey");
    expect(ending.begin(null)).toBe(false);
    expect(ending.begin("ended")).toBe(false);
    vi.advanceTimersByTime(endingMs.lit);
    expect(over).not.toHaveBeenCalled();
  });
});
