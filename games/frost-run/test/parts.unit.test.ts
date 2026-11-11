// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { effects, track } from "../src/audio.ts";
import { cueOf } from "../src/cues.ts";
import { createFrameClock } from "../src/frame-clock.ts";
import type { Happening, HappeningKind } from "../src/rules/types.ts";
import {
  heroWords,
  kindWords,
  roundWords,
  statNames,
  words,
} from "../src/words.ts";
import { click, loadPage } from "./support/dom.ts";

const happening = (kind: HappeningKind, detail = 0): Happening => ({
  detail,
  kind,
  seq: 1,
  tick: 1,
  x: 0,
  y: 0,
});

describe("the cues", () => {
  it("flash orange for a crystal's take and for nothing else, and give every happening its sound", () => {
    expect(cueOf(happening("take", 0))).toEqual({
      flash: true,
      sfx: "crystal",
    });
    expect(cueOf(happening("take", 1))).toEqual({ flash: false, sfx: "egg" });
    expect(cueOf(happening("take", 2))).toEqual({ flash: false, sfx: "key" });
    expect(cueOf(happening("take", 9))).toEqual({ flash: false, sfx: null });
    for (const kind of [
      "hit",
      "crush",
      "bolt",
      "round-clear",
      "dart",
    ] as const) {
      const cue = cueOf(happening(kind));
      expect(cue.flash).toBe(false);
      expect(cue.sfx === null || cue.sfx in effects).toBe(true);
    }
    expect(cueOf(happening("round-end")).sfx).toBeNull();
  });

  it("are sounds the game has, and a loop to play under a run", () => {
    expect(track.voices.length).toBeGreaterThan(0);
    for (const name of ["crystal", "egg", "key", "hit", "win", "lose", "tick"])
      expect(effects).toHaveProperty(name);
  });
});

describe("the words", () => {
  it("name every hero, round and treasure, and say the run's lines", () => {
    for (const hero of Object.values(heroWords))
      expect(hero.story.length).toBeGreaterThan(20);
    expect(roundWords).toHaveLength(3);
    expect(kindWords.egg.many).toBe("Eggs");
    expect(statNames).toHaveLength(5);
    expect(words.playAs("Pip")).toBe("Play as Pip");
    expect(words.round(1)).toBe("Round 2");
    expect(words.roundOf(2)).toBe("Round 3 of 3");
  });
});

describe("the frame clock", () => {
  it("measures real frames, never more than a twentieth of a second, and how far a moment is past its tick", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    const clock = createFrameClock("");
    expect(clock.fixed).toBe(false);
    expect(clock.frame(1016).dt).toBeCloseTo(0.016);
    expect(clock.frame(2000).dt).toBe(0.05);
    clock.restart();
    clock.ticked(0, 1008);
    expect(clock.share()).toBeCloseTo(0.48);
    clock.ticked(1, 1020);
    expect(clock.share()).toBeLessThanOrEqual(1);
    expect(clock.now()).toBe(1000);
    vi.restoreAllMocks();
  });

  it("plays a set number of ticks a frame when asked, whatever the frame rate", () => {
    const fixed = createFrameClock("?fixed=5");
    expect(fixed.fixed).toBe(true);
    const first = fixed.frame(0);
    expect(first.dt).toBeCloseTo(5 / 60);
    expect(fixed.now()).toBe(first.time);
    expect(createFrameClock("?fixed").frame(0).dt).toBeCloseTo(1 / 60);
    expect(createFrameClock("", "3").frame(0).dt).toBeCloseTo(3 / 60);
  });
});

describe("the page's parts", () => {
  it("are found by id and checked, and a tap on a panel's button stays there while a tap elsewhere goes on", async () => {
    loadPage();
    const { keepTaps, page, stopAtButtons } = await import("../src/page.ts");
    expect(page.screen.tagName).toBe("CANVAS");
    const reached = vi.fn();
    page.stage.addEventListener("click", reached);
    stopAtButtons(page.select);
    keepTaps(page.share);
    click(page.select.querySelector("button"));
    expect(reached).not.toHaveBeenCalled();
    click(page.select.querySelector(".story"));
    expect(reached).toHaveBeenCalledOnce();
    click(page.share.querySelector("img"));
    expect(reached).toHaveBeenCalledOnce();
  });

  it("refuse a page that is missing one", async () => {
    vi.resetModules();
    loadPage();
    document.getElementById("flash")?.remove();
    await expect(import("../src/page.ts")).rejects.toThrow("Missing #flash");
  });
});
