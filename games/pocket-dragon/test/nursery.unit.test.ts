import { describe, expect, it } from "vitest";

import { nurseryCards, paintNurseryCard } from "../src/bonus/cards.ts";
import { dragonSpot, drawNursery } from "../src/bonus/nursery-draw.ts";
import { nurseryRun, nurserySounds } from "../src/bonus/nursery-run.ts";
import {
  atNest,
  dancing,
  danceTicks,
  door,
  eggEvery,
  hatchEvery,
  mostDots,
  mostDragons,
  mostEggs,
  names,
  nest,
  pressNursery,
  startNursery,
  tickNursery,
  type NurseryControl,
  type NurseryState,
} from "../src/bonus/nursery.ts";
import { surface } from "./support/canvas.ts";

const play = (state: NurseryState, ticks: number): NurseryState => {
  let now = state;
  for (let at = 0; at < ticks; at += 1) now = tickNursery(now);
  return now;
};
const hold = (state: NurseryState, control: NurseryControl, on = true) =>
  pressNursery(state, control, on);
const start = startNursery(4);

describe("the Sky Nursery", () => {
  it("begins with Glitchy by the left edge and six eggs floating in the sky", () => {
    expect(start.eggs).toHaveLength(mostEggs);
    for (const egg of start.eggs) {
      expect(egg.x).toBeGreaterThanOrEqual(24);
      expect(egg.y).toBeLessThan(100);
    }
    expect(startNursery(4)).toEqual(start);
  });

  it("flies the way held, never off the screen, and gathers an egg it touches (another comes later)", () => {
    const flown = play(hold(start, "right"), 10);
    expect(flown.x).toBe(start.x + 20);
    expect(play(hold(start, "up"), 200).y).toBe(10);
    const [first] = start.eggs;
    if (first === undefined) throw new Error("no eggs");
    const got = tickNursery({ ...start, x: first.x, y: first.y });
    expect(got.carried).toBe(1);
    expect(got.collected).toBe(1);
    expect(got.eggs).toHaveLength(mostEggs - 1);
    expect(play({ ...got, tick: eggEvery - 1 }, 1).eggs).toHaveLength(mostEggs);
  });

  it("hatches the eggs carried into the nest one at a time, with names, up to twelve dragons", () => {
    const home = { ...start, carried: 2, eggs: [], x: nest.x, y: nest.y };
    expect(atNest(home)).toBe(true);
    const one = tickNursery(home);
    expect(one.dragons.map((dragon) => dragon.name)).toEqual([names[0]]);
    expect(one.carried).toBe(1);
    expect(play(one, hatchEvery - 1).dragons).toHaveLength(1);
    expect(play(one, hatchEvery).dragons).toHaveLength(2);
    const full = {
      ...home,
      carried: 5,
      dragons: names.map((name) => ({ look: 0, name })),
    };
    expect(tickNursery(full).dragons).toHaveLength(mostDragons);
    expect(dragonSpot(one, 0)).toEqual(
      expect.objectContaining({ y: expect.any(Number) }),
    );
  });

  it("dances (a new move each time), paints stars in the colour picked, wipes the sky, and lets Glitchy out by the rainbow", () => {
    const danced = hold(start, "act");
    expect(dancing(danced)).toBe(true);
    expect(dancing(play(danced, danceTicks))).toBe(false);
    expect(hold(hold(danced, "act", false), "act").dance).toBe(2);
    const painting = play(hold(hold(start, "evade"), "fire"), 10);
    expect(painting.paint).toHaveLength(5);
    expect(painting.paint[0]?.ink).toBe(1);
    expect(hold(start, "quick").ink).toBe(6);
    expect(hold(painting, "charm").paint).toEqual([]);
    expect(
      play(
        {
          ...hold(start, "fire"),
          paint: Array.from({ length: mostDots }, () => ({
            ink: 0,
            x: 1,
            y: 1,
          })),
        },
        2,
      ).paint,
    ).toHaveLength(mostDots);
    const out = tickNursery({ ...start, x: door.left, y: door.top + 10 });
    expect(out.ended).toBe(true);
    expect(tickNursery(out)).toBe(out);
    expect(hold(out, "act").danceStart).toBe(out.danceStart);
  });

  it("is played by the page as a run that counts for nothing, heard as eggs are gathered, dragons hatch and dances begin", () => {
    const run = nurseryRun(4);
    expect([run.test, run.screen, run.score(), run.plasma()]).toEqual([
      true,
      "nursery",
      0,
      0,
    ]);
    run.hold("right", true);
    run.hold("right", true);
    run.tick();
    expect(run.nursery().x).toBe(start.x + 2);
    expect(run.stats().map(([label]) => label)).toEqual([
      "Eggs",
      "Dragons",
      "Stars",
    ]);
    expect(run.record().inputs).toEqual([]);
    const home = { ...start, carried: 1, eggs: [], x: nest.x, y: nest.y };
    expect(nurserySounds(home, tickNursery(home))).toEqual(["freed"]);
    expect(nurserySounds(start, hold(start, "act"))).toEqual(["levelup"]);
    expect(
      nurserySounds(start, { ...start, collected: 1, ended: true }),
    ).toEqual(["egg", "whoosh"]);
    const screen = surface();
    run.draw(screen.context, false);
    expect(screen.texts()).toContain("WELCOME TO THE SECRET SKY NURSERY!");
  });

  it("draws the new dragon's name as it hatches, and the dragons dancing", () => {
    const hatched = tickNursery({
      ...start,
      carried: 1,
      eggs: [],
      tick: 300,
      x: nest.x,
      y: nest.y,
    });
    const screen = surface();
    drawNursery(screen.context, hold(hatched, "act"));
    expect(screen.texts()).toContain(`${names[0] ?? ""} HATCHED!`);
  });

  it("makes three cards to share, in every size: the dragon family, the sky art, the dance party", () => {
    const visit = {
      ...start,
      dragons: [
        { look: 2, name: "PIP" },
        { look: 5, name: "MOCHI" },
      ],
      paint: [{ ink: 3, x: 50, y: 50 }],
    };
    for (const kind of nurseryCards)
      for (const [width, height] of [
        [1080, 1080],
        [1080, 1920],
        [1920, 1080],
      ] as const) {
        const card = surface();
        const alt = paintNurseryCard(card.context, width, height, visit, kind);
        expect(alt).toContain("Sky Nursery");
        expect(card.drawn.length).toBeGreaterThan(20);
      }
    const family = surface();
    paintNurseryCard(family.context, 1080, 1080, visit, "family");
    expect(family.texts()).toEqual(
      expect.arrayContaining([
        "MY DRAGON FAMILY",
        "GLITCHY",
        "MOCHI",
        "2 BABY DRAGONS HATCHED",
      ]),
    );
    const art = surface();
    paintNurseryCard(art.context, 1080, 1080, visit, "art");
    expect(art.texts()).toContain("1 STAR PAINTED");
  });
});
