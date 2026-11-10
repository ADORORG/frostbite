// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ticksPerSecond } from "../src/rules/constants.ts";
import { advanceTo, type RunState } from "../src/rules/index.ts";
import { createHud } from "../src/ui/hud.ts";
import { createWatch } from "../src/ui/watch.ts";
import { roundWords, words } from "../src/words.ts";
import { playBot } from "./support/bot.ts";
import { byId, loadPage } from "./support/dom.ts";
import { frames } from "./support/view.ts";
import { start, step } from "./support/rules.ts";

beforeEach(() => {
  loadPage();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const text = (id: string) => byId(id, HTMLElement).textContent;
// A run left alone, a tick at a time, until its first round has `seconds` left to play.
const leftWith = (seconds: number): RunState => {
  let state = step(start(5), "lead", 4);
  while (state.phase === "play" && state.timeLeft > seconds * ticksPerSecond)
    state = advanceTo(state, state.tick + 1);
  return state;
};

describe("the readouts over a run", () => {
  it("show the round, the time and this round's treasure, and the whole run's against what it needs", () => {
    const hud = createHud(document, byId("stage", HTMLElement));
    const { inputs, state } = playBot(1004, 4);
    let last: RunState = state;
    for (const [, now] of frames(1004, inputs)) {
      hud.update(now);
      last = now;
    }
    expect(text("round")).toBe("3/3");
    expect(document.querySelectorAll(".gauge.met")).toHaveLength(3);
    expect(
      document
        .querySelector('.gauge[data-kind="egg"]')
        ?.getAttribute("aria-label"),
    ).toContain("Eggs");
    expect(last.ended).toBe(true);
    hud.reset();
    const fresh = step(start(5), "lead", 4);
    hud.update(fresh);
    expect(text("round")).toBe("1/3");
    expect(text("time")).toBe("60");
    expect(document.querySelector(".banner .title")?.textContent).toContain(
      roundWords[0].name,
    );
    hud.update(leftWith(8));
    expect(byId("time", HTMLElement).parentElement?.classList).toContain("low");
    const powers = [...document.querySelectorAll<HTMLElement>(".power")];
    expect(powers.every((power) => power.hidden)).toBe(true);
  });

  it("light the crystal count and the screen's edge for a moment, and show a toast and a banner", () => {
    const hud = createHud(document, byId("stage", HTMLElement));
    hud.crystalFlash();
    expect(document.querySelector(".flash")?.classList).toContain("on");
    expect(document.querySelector(".read-crystal")?.classList).toContain(
      "struck",
    );
    vi.advanceTimersByTime(300);
    expect(document.querySelector(".flash")?.classList).not.toContain("on");
    hud.toast("First spark");
    expect(document.querySelector(".toast")?.textContent).toBe("First spark");
    vi.advanceTimersByTime(3000);
    expect(document.querySelector(".toast")?.classList).not.toContain("on");
    hud.banner("Round 2", "Roll");
    vi.advanceTimersByTime(3000);
    expect(document.querySelector(".banner")?.classList).not.toContain("on");
  });

  it("refuse a page without its readouts", () => {
    byId("time", HTMLElement).remove();
    expect(() => createHud(document, byId("stage", HTMLElement))).toThrow(
      "Missing #time",
    );
  });
});

describe("what the page watches each frame of a run", () => {
  it("beeps the last five seconds, frosts the screen while frost vision holds, and names how a round ended", () => {
    const stage = byId("stage", HTMLElement);
    const hud = {
      banner: vi.fn(),
      crystalFlash: vi.fn(),
      reset: vi.fn(),
      toast: vi.fn(),
      update: vi.fn(),
    };
    const controls = {
      buttons: () => 0,
      forRound: vi.fn(),
      poll: vi.fn(),
      way: () => -1,
    };
    const sfx = vi.fn();
    const watch = createWatch({ controls, hud, sfx, stage });
    const { inputs } = playBot(1004, 4);
    let frosted = false;
    for (const [, now] of frames(1004, inputs)) {
      watch(now, true);
      frosted ||= stage.classList.contains("frosted");
    }
    expect(frosted).toBe(true);
    expect(
      hud.banner.mock.calls.map(([title]) => String(title)).join(),
    ).toContain(words.cleared);
    expect(controls.forRound).toHaveBeenCalledWith(2);
    let quiet = leftWith(5);
    watch(quiet, true);
    while (quiet.phase === "play") {
      quiet = advanceTo(quiet, quiet.tick + 1);
      watch(quiet, false);
    }
    // One a second from five down, unless a hit takes the last seconds at once.
    const beeps = sfx.mock.calls.filter(([name]) => name === "tick").length;
    expect(beeps).toBeGreaterThanOrEqual(1);
    expect(beeps).toBeLessThanOrEqual(5);
    expect(
      hud.banner.mock.calls.map(([title]) => String(title)).join(),
    ).toContain(words.timeUp);
  });
});
