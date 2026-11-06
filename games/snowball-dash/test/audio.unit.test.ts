import { frequency, stepsAt } from "@frostbite/game-sdk/audio/tracks";
import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { tempoAt, worldSounds } from "../src/feedback.ts";
import { bare } from "./support/states.ts";

describe("Snowball Dash's sound", () => {
  it("has a track whose notes are playable pitches and whose voices all sound somewhere", () => {
    expect(track.tempo).toBeGreaterThan(60);
    for (const voice of track.voices) {
      expect(voice.notes.some((note) => note !== null)).toBe(true);
      for (const note of voice.notes) {
        if (note === null) continue;
        expect(frequency(note)).toBeGreaterThan(40);
        expect(frequency(note)).toBeLessThan(4000);
      }
    }
    expect(stepsAt(track, 0).length).toBeGreaterThan(0);
  });

  it("has an effect for each thing that happens, each short and audible, and a shard that rings higher for each step of a streak", () => {
    expect(Object.keys(effects).sort()).toEqual([
      "die",
      "fall",
      "hop",
      "land",
      "level",
      "milestone",
      "near",
      "shard0",
      "shard1",
      "shard2",
      "shard3",
      "shard4",
      "start",
    ]);
    for (const effect of Object.values(effects))
      for (const part of effect) {
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
      }
    const pitch = (name: "shard0" | "shard4") => effects[name][0]?.from ?? 0;
    expect(pitch("shard4")).toBeGreaterThan(pitch("shard0"));
  });
});

describe("what the slope sounds like", () => {
  it("hops with a rising tone when the snowball leaves the snow", () => {
    expect(worldSounds(bare({ hops: 0 }), bare({ hops: 1 }))).toEqual(["hop"]);
  });

  it("lands with a thud when a hop ends on the snow, and is quiet otherwise", () => {
    const air = bare({ air: 5 });
    expect(worldSounds(air, bare({ air: 0 }))).toEqual(["land"]);
    expect(worldSounds(air, bare({ air: 6 }))).toEqual([]);
    expect(worldSounds(bare(), bare())).toEqual([]);
    expect(worldSounds(air, bare({ air: 0, alive: false }))).toEqual(["die"]);
  });

  it("rings a shard higher the longer the streak, up to the highest", () => {
    expect(worldSounds(bare(), bare({ shardsTaken: 1, streak: 0 }))).toEqual([
      "shard0",
    ]);
    expect(worldSounds(bare(), bare({ shardsTaken: 1, streak: 2 }))).toEqual([
      "shard2",
    ]);
    expect(worldSounds(bare(), bare({ shardsTaken: 1, streak: 9 }))).toEqual([
      "shard4",
    ]);
  });

  it("chimes for a close call, and for a new level", () => {
    expect(worldSounds(bare(), bare({ closeCalls: 1 }))).toEqual(["near"]);
    expect(
      worldSounds(bare({ distance: 11_999 }), bare({ distance: 12_000 })),
    ).toEqual(["level"]);
  });

  it("tells a rock from a crevasse when the run ends", () => {
    expect(worldSounds(bare(), bare({ alive: false, cause: "hit" }))).toEqual([
      "die",
    ]);
    expect(worldSounds(bare(), bare({ alive: false, cause: "fell" }))).toEqual([
      "fall",
    ]);
    expect(worldSounds(bare({ alive: false }), bare({ alive: false }))).toEqual(
      [],
    );
  });

  it("speeds the music up a little each level, up to half again as fast", () => {
    expect(tempoAt(0)).toBe(1);
    expect(tempoAt(5)).toBeCloseTo(1.15);
    expect(tempoAt(100)).toBe(1.5);
  });
});
