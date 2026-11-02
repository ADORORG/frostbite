import { describe, expect, it } from "vitest";

import {
  blastNext,
  blastRolled,
  blastStepTicks,
  blastTiles,
  blazeTicks,
  emptyPack,
  isItem,
  kitOf,
  mostOfEach,
  packItem,
  packTaken,
  shrink,
  startPowers,
  startTileBlast,
  useItem,
  wearOff,
} from "../src/rules/kit.ts";
const packed = (more: Partial<typeof emptyPack>) =>
  startPowers({ big: false, pack: { ...emptyPack, ...more } });

describe("the backpack", () => {
  it("keeps up to nine of each food, and says what was last put in", () => {
    let powers = startPowers();
    for (let at = 0; at < 12; at += 1)
      powers = packItem(powers, "mushroom", at);
    expect(powers.pack).toEqual({ ...emptyPack, mushroom: mostOfEach });
    expect(powers.news).toEqual({ item: "mushroom", tick: 11, what: "packed" });
    expect(isItem("berry") && isItem("pineapple") && !isItem("fire")).toBe(
      true,
    );
  });

  it("uses a food only when there is one: a berry blazes, a pineapple grows Glitchy (once at a time)", () => {
    expect(useItem(startPowers(), "berry", 5)).toBeNull();
    const berry = useItem(packed({ berry: 2 }), "berry", 5);
    expect(berry?.blaze).toBe(blazeTicks);
    expect(berry?.pack.berry).toBe(1);
    expect(berry?.used).toBe(1);
    expect(berry?.news).toEqual({ item: "berry", tick: 5, what: "used" });
    const big = useItem(packed({ pineapple: 2 }), "pineapple", 5);
    expect(big?.big).toBe(true);
    expect(big === null ? null : useItem(big, "pineapple", 6)).toBeNull();
    expect(useItem(packed({ mushroom: 1 }), "mushroom", 5)?.pack.mushroom).toBe(
      0,
    );
  });

  it("lets the blaze burn down, and a bump while big only shrinks Glitchy", () => {
    const blazing = useItem(packed({ berry: 1 }), "berry", 0);
    expect(blazing === null ? 0 : wearOff(blazing).blaze).toBe(blazeTicks - 1);
    const calm = startPowers();
    expect(wearOff(calm)).toBe(calm);
    expect(shrink(calm, 3)).toBeNull();
    const shrunk = shrink({ ...calm, big: true }, 3);
    expect(shrunk?.big).toBe(false);
    expect(shrunk?.shrinks).toBe(1);
    expect(shrunk?.news).toEqual({
      item: "pineapple",
      tick: 3,
      what: "shrank",
    });
  });

  it("hands on the backpack and Glitchy's size, and packs only what is newly taken", () => {
    const kit = { big: true, pack: { ...emptyPack, berry: 3 } };
    expect(kitOf(startPowers(kit))).toEqual(kit);
    const spots = [{ item: "berry" as const, x: 1, y: 1 }];
    const before = [false];
    const same = packTaken(startPowers(), spots, before, [false], 1);
    expect(same.kitTaken).toBe(before);
    const got = packTaken(startPowers(), spots, before, [true], 1);
    expect(got.kitTaken).toEqual([true]);
    expect(got.powers.pack.berry).toBe(1);
  });

  it("rolls a blast over tiles a tile every few ticks, as far as it can go", () => {
    const blast = startTileBlast(4, 4, { x: 1, y: 0 }, 10);
    expect(blastNext(blast, 10 + blastStepTicks - 1)).toBeNull();
    const to = blastNext(blast, 10 + blastStepTicks);
    expect(to).toEqual({ x: 5, y: 4 });
    const rolled = blastRolled(blast, { x: 5, y: 4 }, 13);
    expect(rolled.left).toBe(blastTiles - 1);
    expect(blastNext({ ...rolled, left: 0 }, 99)).toBeNull();
  });
});
