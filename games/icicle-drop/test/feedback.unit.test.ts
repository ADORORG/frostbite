import { frequency } from "@ador/game-sdk/audio/tracks";
import { describe, expect, it } from "vitest";

import { effects, joinSound, track } from "../src/audio.ts";
import { moveSound } from "../src/feedback.ts";
import { startDrop } from "../src/rules/state.ts";

const base = startDrop(7);

describe("the sound of a move", () => {
  it("is a join, with the biggest tile on the board, when the move joined tiles; a slide when it only moved them", () => {
    const joined = {
      ...base,
      board: [1, 3, 0, 5, ...base.board.slice(4)],
      merges: 1,
    };
    expect(moveSound(base, joined)).toEqual({ biggest: 5, kind: "join" });
    expect(moveSound(base, { ...base, merges: 0 })).toEqual({ kind: "slide" });
    expect(moveSound({ ...base, merges: 4 }, { ...base, merges: 4 })).toEqual({
      kind: "slide",
    });
  });

  it("rings higher for a bigger tile, and never past the top of what a speaker is asked for", () => {
    const pitch = (biggest: number) => joinSound(biggest)[0]?.from ?? 0;
    expect(pitch(2)).toBeGreaterThan(pitch(1));
    expect(pitch(11)).toBeGreaterThan(pitch(2));
    expect(pitch(40)).toBe(pitch(12));
    expect(pitch(40)).toBeLessThan(frequency(120));
    for (const part of joinSound(3)) expect(part.seconds).toBeLessThan(1);
  });
});

describe("Icicle Drop's sound", () => {
  it("has a track whose notes are playable and whose voices all sound somewhere", () => {
    expect(track.tempo).toBeGreaterThan(60);
    for (const voice of track.voices) {
      expect(voice.notes.some((note) => note !== null)).toBe(true);
      for (const note of voice.notes) {
        if (note === null) continue;
        expect(frequency(note)).toBeGreaterThan(40);
        expect(frequency(note)).toBeLessThan(4000);
      }
    }
  });

  it("has an effect for each thing that happens, each short and audible", () => {
    expect(Object.keys(effects).sort()).toEqual([
      "lose",
      "milestone",
      "slide",
      "start",
    ]);
    for (const effect of Object.values(effects))
      for (const part of effect) {
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
      }
  });
});
