import { describe, expect, it } from "vitest";

import { button, maxTicks, verifierId } from "../src/rules/constants.ts";
import { leads, milestones, rules, type RunState } from "../src/rules/index.ts";
import { start, step } from "./support/rules.ts";

describe("the rules", () => {
  it("refuse settings, and seeds that are not 32-bit whole numbers", () => {
    expect(rules.init(1, { mines: 3 }).ok).toBe(false);
    expect(rules.init(-1, {}).ok).toBe(false);
    expect(rules.init(2 ** 32, {}).ok).toBe(false);
    expect(rules.init(1.5, {}).ok).toBe(false);
    expect(rules.init(0xffffffff, {}).ok).toBe(true);
    expect(rules.id).toBe(verifierId);
  });

  it("take the lead first, once, and only one that exists", () => {
    const state = start();
    expect(rules.step(state, { data: [0, 0, 0], type: "p" }).ok).toBe(false);
    expect(rules.step(state, { data: leads.length, type: "lead" }).ok).toBe(
      false,
    );
    expect(rules.step(state, { data: "volt", type: "lead" }).ok).toBe(false);
    const led = step(state, "lead", 2);
    expect(rules.step(led, { data: 1, type: "lead" }).ok).toBe(false);
    expect(rules.step(led, { data: 1, type: "dance" }).ok).toBe(false);
  });

  it("keep changes of the hands apart, in range and in whole numbers", () => {
    const led = step(start(), "lead", 0);
    const moved = step(led, "p", [10, 4, 0]);
    const refused = (data: unknown): boolean =>
      !rules.step(moved, { data: data as number[], type: "p" }).ok;
    expect(refused([11, 5, 0])).toBe(true);
    expect(refused([13, 4, 0])).toBe(true);
    expect(refused([13, 16, 0])).toBe(true);
    expect(refused([13, 4, 32])).toBe(true);
    expect(refused([9, 3, 0])).toBe(true);
    expect(refused([13, 5])).toBe(true);
    expect(refused([13, 5, 0.5])).toBe(true);
    expect(refused("13,5,0")).toBe(true);
    expect(refused([13, 5, button.hop])).toBe(false);
  });

  it("end a run where it is told to, once, and refuse an end that is not a tick", () => {
    const led = step(start(), "lead", 4);
    expect(rules.step(led, { data: 1.5, type: "end" }).ok).toBe(false);
    expect(rules.step(led, { data: "soon", type: "end" }).ok).toBe(false);
    const ended = step(led, "end", 120);
    expect(ended.ended).toBe(true);
    expect(ended.tick).toBe(120);
    expect(rules.step(ended, { data: [130, 1, 0], type: "p" }).ok).toBe(false);
  });

  it("move the hero the way the hands point, and play the same run the same way twice", () => {
    const play = (): RunState => {
      let state = step(step(start(99), "lead", 4), "p", [0, 4, 0]);
      state = step(state, "p", [90, 8, button.hop]);
      return step(state, "end", 400);
    };
    const first = play();
    expect(first.player.x).toBeGreaterThan(0);
    expect(first.ended).toBe(true);
    expect(JSON.stringify(play())).toBe(JSON.stringify(first));
    expect(
      JSON.stringify(step(step(start(98), "lead", 4), "end", 400)),
    ).not.toBe(JSON.stringify(first));
  });

  it("end a run that is left alone when its three rounds are over, with nothing won", () => {
    const state = step(step(start(3), "lead", 1), "end", maxTicks);
    expect(state.ended).toBe(true);
    expect(state.round).toBe(2);
    expect(state.won).toBe(false);
    expect(rules.earned(state).join(" ")).not.toContain("win-as");
  });

  it("give the score once the run has ended, and none before", () => {
    const led = step(start(5), "lead", 3);
    expect(rules.score?.(led)).toBeNull();
    const ended = step(led, "end", 600);
    expect(rules.score?.(ended)).toBe(ended.score);
  });

  it("have between ten and forty milestones, each named once", () => {
    expect(milestones.length).toBeGreaterThanOrEqual(10);
    expect(milestones.length).toBeLessThanOrEqual(40);
    expect(new Set(milestones.map(({ id }) => id)).size).toBe(
      milestones.length,
    );
  });
});
