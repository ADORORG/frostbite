import { describe, expect, it } from "vitest";

import { defu, hallRows } from "../src/rules/woods/base-map.ts";
import {
  allyLook,
  animateDragon,
  glitchyLook,
  makeDragon,
  shadowLook,
} from "../src/three/dragon.ts";
import {
  makeLaser,
  makeParty,
  makeWave,
  setConfetti,
  setLaser,
  setSmoke,
  setWave,
} from "../src/three/effects.ts";
import {
  animateDefu,
  animateGuard,
  makeDefu,
  makeGuard,
} from "../src/three/people.ts";

describe("DeFu's weapons in three dimensions", () => {
  it("show her laser as a thin line along a row while it glows, and a white-hot beam down a column while it burns", () => {
    const laser = makeLaser();
    setLaser(laser, null, "glow", 0);
    expect(laser.root.visible).toBe(false);
    setLaser(laser, { horizontal: true, line: 6 }, null, 0);
    expect(laser.root.visible).toBe(false);
    setLaser(laser, { horizontal: true, line: 6 }, "glow", 0);
    expect(laser.root.visible).toBe(true);
    expect(laser.core.visible).toBe(false);
    expect(laser.root.position.z).toBe(6.5);
    expect(laser.halo.scale.x).toBe(26);
    setLaser(laser, { horizontal: false, line: 9 }, "burn", 0);
    expect(laser.core.visible).toBe(true);
    expect(laser.root.position.x).toBe(9.5);
    expect(laser.core.scale.z).toBe(hallRows);
    expect(laser.core.scale.x).toBeGreaterThan(0.15);
  });

  it("show her shockwave gathering under her platform, then as a square ring that stops at the edge of the hall", () => {
    const wave = makeWave();
    setWave(wave, null, 0);
    expect(wave.root.visible).toBe(false);
    setWave(wave, 0, 0);
    expect(wave.glow.visible).toBe(true);
    expect(wave.edges.some((edge) => edge.visible)).toBe(false);
    setWave(wave, 1, 0);
    expect(wave.glow.visible).toBe(false);
    expect(wave.edges.map((edge) => edge.visible)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(wave.edges[0]?.scale.x).toBe(3);
    setWave(wave, 9, 0);
    expect(wave.edges.map((edge) => edge.visible)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(wave.edges[2]?.position.x).toBe(defu.x - 9 + 0.5);
  });

  it("throw confetti round the defused rocket and smoke under the one that leaves, only while their scenes play", () => {
    const party = makeParty();
    setConfetti(party, [14, 0, 6], null);
    setSmoke(party, [14, 0, 6], null);
    expect(party.confetti.visible).toBe(false);
    expect(party.smoke.some((puff) => puff.visible)).toBe(false);
    setConfetti(party, [14, 0, 6], 0.3);
    const places = party.confetti.geometry.getAttribute("position");
    expect(party.confetti.visible).toBe(true);
    expect(Math.abs(places.getX(0) - 14)).toBeLessThan(6);
    setSmoke(party, [14, 0, 6], 0.5);
    expect(party.smoke.every((puff) => puff.visible)).toBe(true);
    expect(party.smoke[0]?.scale.x).toBeCloseTo(0.55);
  });
});

describe("the people and dragons of the woods in three dimensions", () => {
  it("beat their wings, step their legs while walking and swish their tails, each in its own colours", () => {
    const glitchy = makeDragon(glitchyLook);
    animateDragon(glitchy, 0.3, true);
    const [left, right] = glitchy.wings;
    expect(left.rotation.z).toBeCloseTo(-right.rotation.z);
    const stepping = glitchy.legs.map((leg) => leg.rotation.x);
    animateDragon(glitchy, 0.3, false, true);
    expect(glitchy.legs.map((leg) => leg.rotation.x)).not.toEqual(stepping);
    expect(glitchy.tail).toHaveLength(4);
    expect(allyLook(9).body).toBe("#ff9f43");
    expect(allyLook(1).body).not.toBe(glitchyLook.body);
    const shadow = makeDragon(shadowLook);
    expect(shadow.pixels).toHaveLength(shadowLook.pixels.length);
  });

  it("march DeFu's guards with swinging arms, seeing stars when dizzy, and raise DeFu's arm with her eyes aglow before her laser", () => {
    const guard = makeGuard();
    animateGuard(guard, 0.2, true, false);
    expect(guard.stars.visible).toBe(false);
    expect(guard.arms[0].rotation.x).toBeCloseTo(-guard.arms[1].rotation.x);
    animateGuard(guard, 0.2, false, true);
    expect(guard.stars.visible).toBe(true);
    const defuNow = makeDefu();
    animateDefu(defuNow, 1, true, false);
    expect(defuNow.eyes.emissiveIntensity).toBe(2.5);
    expect(defuNow.arm.rotation.z).toBe(2.6);
    animateDefu(defuNow, 1, false, true);
    expect(defuNow.eyes.emissiveIntensity).toBe(0);
    expect(defuNow.root.scale.y).toBe(0.92);
  });
});
