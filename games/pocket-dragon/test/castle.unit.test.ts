import { describe, expect, it } from "vitest";

import { stepTicks, trailLength } from "../src/rules/castle/constants.ts";
import { castleChapter, castleRules } from "../src/rules/castle/index.ts";
import {
  mapHeight,
  mapRows,
  mapWidth,
  tileAt,
} from "../src/rules/castle/map.ts";
import {
  banner,
  boulders,
  brambles,
  foes,
  friends,
  ice,
  items,
  start,
} from "../src/rules/castle/places.ts";
import {
  pressCastle,
  startCastle,
  tickCastle,
} from "../src/rules/castle/tick.ts";
import type {
  CastleControl,
  CastleState,
  Facing,
} from "../src/rules/castle/types.ts";

const floor = new Set([".", ",", "f", "s", "c"]);
const at = (
  x: number,
  y: number,
  more: Partial<CastleState> = {},
  facing: Facing = "down",
) => ({
  ...startCastle(2),
  facing,
  x,
  y,
  ...more,
});
const hold = (state: CastleState, control: CastleControl, on = true) => {
  const stepped = castleRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: control,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};
const play = (state: CastleState, count: number) => {
  let now = state;
  for (let tick = 0; tick < count; tick += 1) now = tickCastle(now);
  return now;
};
const said = (state: CastleState) => state.message?.id;
const yes = [true, true, true, true];

describe("the land between the woods and the castle", () => {
  it("is 40 tiles by 30, drawn only in its legend, and closed all round", () => {
    expect([mapWidth, mapHeight]).toEqual([40, 30]);
    for (const row of mapRows) expect(row).toMatch(/^[T.,fs~LoI#HWc]{40}$/u);
    for (let x = 0; x < mapWidth; x += 1) {
      expect(floor.has(tileAt(x, 0))).toBe(false);
      expect(floor.has(tileAt(x, mapHeight - 1))).toBe(false);
    }
    for (let y = 0; y < mapHeight; y += 1) {
      expect(floor.has(tileAt(0, y))).toBe(false);
      expect(floor.has(tileAt(mapWidth - 1, y))).toBe(false);
    }
    expect(tileAt(-1, 3)).toBe("T");
  });

  it("has everyone on open ground, and each obstacle on its own kind of tile", () => {
    for (const spot of [start, banner, ...items, ...friends, ...foes])
      expect(floor.has(tileAt(spot.x, spot.y))).toBe(true);
    for (const spot of boulders) expect(tileAt(spot.x, spot.y)).toBe("o");
    for (const spot of brambles) expect(tileAt(spot.x, spot.y)).toBe("#");
    expect(tileAt(ice.x, ice.y)).toBe("I");
  });
});

describe("the guild's rules", () => {
  it("start from the seed, with the keepers' favourite shows laid out by it", () => {
    expect(startCastle(5)).toEqual(startCastle(5));
    expect(castleRules.init(5, {})).toEqual({
      ok: true,
      state: startCastle(5),
    });
    const favourites = new Set(
      Array.from({ length: 30 }, (_, seed) =>
        startCastle(seed).favourites.join(),
      ),
    );
    expect(favourites.size).toBeGreaterThan(10);
  });

  it("walk a tile at a time while a way is held, with the guild on the trail behind", () => {
    const walking = tickCastle(hold(startCastle(1), "right"));
    expect([walking.x, walking.y]).toEqual([start.x + 1, start.y]);
    expect(walking.step).not.toBeNull();
    const arrived = play(walking, stepTicks);
    expect(arrived.step).toBeNull();
    const far = play(arrived, stepTicks * 6);
    expect(far.x).toBeGreaterThan(arrived.x + 4);
    expect(far.trail).toHaveLength(trailLength);
    const stopped = play(hold(far, "right", false), stepTicks * 3);
    expect([stopped.x, stopped.step]).toEqual([far.x, null]);
    const river = play(hold(startCastle(1), "up"), stepTicks * 8);
    expect(river.y).toBe(22);
  });

  it("turn to face a tree instead of walking into it, and walk round the other way", () => {
    const facingTree = tickCastle(hold(at(1, 22), "left"));
    expect([facingTree.x, facingTree.facing, facingTree.step]).toEqual([
      1,
      "left",
      null,
    ]);
    expect(pressCastle(at(1, 22, {}, "down"), "left").facing).toBe("left");
  });

  it("let a friend join only with the thing it wants, and pick up things by walking onto them", () => {
    const asked = pressCastle(at(21, 24), "right");
    expect(said(asked)).toBe("wants-0");
    expect(asked.friends[0]).toBe(false);
    const fetched = play(hold(at(5, 27), "down"), stepTicks + 1);
    expect(said(fetched)).toBe("got-0");
    expect([fetched.held[0], fetched.taken[0]]).toEqual([true, true]);
    const joined = pressCastle(
      { ...fetched, x: 21, y: 24, step: null },
      "right",
    );
    expect(said(joined)).toBe("joined-0");
    expect([joined.friends[0], joined.held[0]]).toEqual([true, false]);
    expect(said(pressCastle({ ...joined, facing: "right" }, "act"))).toBe(
      "joined-0",
    );
  });

  it("need Bolt for a boulder, Splash for the ford and Bloom for the brambles", () => {
    const boulder = pressCastle(at(30, 25), "right");
    expect(said(boulder)).toBe("boulder");
    const pushed = pressCastle(
      at(30, 25, { friends: [true, false, false, false] }),
      "right",
    );
    expect([said(pushed), pushed.pushed[1]]).toEqual(["pushed", true]);
    expect(said(pressCastle(at(23, 22), "up"))).toBe("river");
    const lilies = pressCastle(
      at(23, 22, { friends: [false, true, false, false] }),
      "up",
    );
    expect([said(lilies), lilies.lilies]).toEqual(["lilies", true]);
    expect(said(pressCastle(at(19, 15), "up"))).toBe("bramble");
    const parted = pressCastle(
      at(19, 15, { friends: [false, false, true, false] }),
      "up",
    );
    expect([said(parted), parted.opened[0]]).toEqual(["parted", true]);
    const through = play(hold(parted, "up"), stepTicks * 2 + 3);
    expect(through.y).toBeLessThan(14);
    expect(through.escapedWoods).toBe(true);
  });

  it("melt the ice with a breath of fire at it, and only at it", () => {
    const bumped = pressCastle(at(9, 17), "left");
    expect(said(bumped)).toBe("ice");
    const missed = hold(at(9, 17, {}, "up"), "fire");
    expect([missed.melted, missed.fireTick]).toEqual([false, 0]);
    const melted = hold(bumped, "fire");
    expect([said(melted), melted.melted]).toEqual(["melted", true]);
    const inside = play(
      hold(hold(melted, "fire", false), "left"),
      stepTicks * 2 + 3,
    );
    expect(said(inside)).toBe("got-2");
  });

  it("count the river crossed, start a cheer challenge at a grumpy guard, and raise the banner once every keeper has cheered", () => {
    const crossed = play(
      hold(at(23, 20, { lilies: true }), "up"),
      stepTicks + 1,
    );
    expect(crossed.crossedRiver).toBe(true);
    const challenged = pressCastle(at(19, 11), "up");
    expect(said(challenged)).toBe("challenge-0");
    expect(challenged.battle?.foe).toBe(0);
    const throne = at(19, 3, { cheered: yes });
    const notYet = play(
      hold(at(19, 3, { cheered: [true, true, true, false] }), "up"),
      stepTicks + 1,
    );
    expect(notYet.bannerRaised).toBe(false);
    const raised = play(hold(throne, "up"), stepTicks + 1);
    expect([said(raised), raised.bannerRaised]).toEqual(["captured", true]);
    expect(raised.finishTick).not.toBeNull();
    expect(castleChapter.done(raised)).toBe(true);
    expect(tickCastle(raised).tick).toBe(raised.tick + 1);
  });
});
