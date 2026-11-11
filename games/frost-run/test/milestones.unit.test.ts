import { describe, expect, it } from "vitest";

import { leads } from "../src/rules/leads.ts";
import { milestones } from "../src/rules/milestones.ts";
import { totals } from "../src/rules/round.ts";
import {
  hopper,
  hunter,
  lingering,
  playBot,
  strong,
  tourist,
  type BotStyle,
} from "./support/bot.ts";

const earnedBy = (style: BotStyle, seed: number, lead: number): string[] => {
  const { state } = playBot(seed, lead, style);
  return milestones.filter(({ earned }) => earned(state)).map(({ id }) => id);
};

// Every milestone can be earned by playing: each by a bot that plays for it, so a milestone nobody can reach is caught here.
describe("the milestones", () => {
  it("are every one earned by the bots, each where it should be", () => {
    const seen = new Set<string>();
    for (const [index] of leads.entries())
      for (const id of earnedBy(strong, 1000 + index, index)) seen.add(id);
    for (const id of earnedBy(tourist, 7919, 0)) seen.add(id);
    expect(earnedBy(tourist, 7919, 0)).toContain("island-hopper");
    expect(earnedBy(hopper, 7919, 0)).toContain("hop-scotch");
    expect(earnedBy(hunter, 7919, 0)).toContain("snow-crusher");
    expect(earnedBy(lingering, 7919 * 4, 3)).toContain("heads-down");
    for (const id of [
      ...earnedBy(hopper, 7919, 0),
      ...earnedBy(hunter, 7919, 0),
      ...earnedBy(lingering, 7919 * 4, 3),
    ])
      seen.add(id);
    expect([...seen].sort()).toEqual(milestones.map(({ id }) => id).sort());
  });

  it("let every hero win, and the win is that hero's own", () => {
    for (const [index, lead] of leads.entries()) {
      const { state } = playBot(1000 + index, index);
      expect(state.won).toBe(true);
      const own = milestones.find(({ id }) => id === `win-as-${lead.id}`);
      expect(own?.earned(state)).toBe(true);
      for (const other of leads)
        if (other !== lead)
          expect(
            milestones
              .find(({ id }) => id === `win-as-${other.id}`)
              ?.earned(state),
          ).toBe(false);
    }
  });

  it("are not won by a run that leaves the eggs and keys, nor by one that ignores the snowballs", () => {
    const { state } = playBot(31, 4, lingering);
    expect(totals(state.tallies).egg).toBe(0);
    expect(state.won).toBe(false);
    const careless = playBot(31, 4, { ...strong, dodge: false }).state;
    expect(careless.tallies.some(({ hits }) => hits > 0)).toBe(true);
  });

  it("each have a name and a line, written once", () => {
    for (const { description, name } of milestones) {
      expect(name.length).toBeGreaterThan(2);
      expect(description).toMatch(/\.$/u);
    }
    expect(new Set(milestones.map(({ name }) => name)).size).toBe(
      milestones.length,
    );
  });
});
