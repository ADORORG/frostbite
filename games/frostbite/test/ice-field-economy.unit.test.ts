import type { JsonValue } from "@frostbite/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import {
  firstGlacier,
  firstWin,
  glacierCosts,
  iceFieldRules,
  maxBoards,
  type IceFieldState,
} from "../src/verifier/ice-field.ts";
import {
  apply,
  input,
  refusal,
  safeTiles,
  start,
} from "./support/ice-field.ts";

describe("building a glacier", () => {
  const withIcicles = (icicles: number, glacierTier = 0): IceFieldState => ({
    ...start(),
    glacierTier,
    icicles,
  });

  it("spends the tier's cost and raises the tier, in order", () => {
    const built = apply(
      withIcicles(glacierCosts[0] ?? 0),
      input("build-glacier", 1),
    );
    expect(built).toMatchObject({ glacierTier: 1, icicles: 0 });
    const second = apply(withIcicles(1_500, 1), input("build-glacier", 2));
    expect(second).toMatchObject({
      glacierTier: 2,
      icicles: 1_500 - (glacierCosts[1] ?? 0),
    });
  });

  it("is refused without enough icicles, out of order, or for a tier there is not", () => {
    expect(refusal(withIcicles(299), input("build-glacier", 1))).toBe(
      "not enough icicles for that tier",
    );
    expect(refusal(withIcicles(99_999), input("build-glacier", 2))).toBe(
      "a glacier tier is built in order, starting with 1",
    );
    expect(refusal(withIcicles(99_999, 1), input("build-glacier", 1))).toBe(
      "a glacier tier is built in order, starting with 1",
    );
    expect(refusal(withIcicles(99_999, 3), input("build-glacier", 4))).toBe(
      "there is no such glacier tier",
    );
    for (const bad of [0, 1.5, "1", null, -1])
      expect(
        refusal(withIcicles(99_999), input("build-glacier", bad as never)),
      ).toBe("a glacier tier is built in order, starting with 1");
    expect(refusal(withIcicles(99_999), { type: "build-glacier" })).toContain(
      "in order",
    );
  });

  it("can be afforded by playing: enough won boards pay for the first tier", () => {
    let state = start(11);
    for (let board = 0; board < 4; board += 1)
      state = apply(
        state,
        ...safeTiles(11, board)
          .slice(0, 12)
          .map((t) => input("pick", t)),
        input("settle"),
      );
    expect(state.icicles).toBeGreaterThanOrEqual(glacierCosts[0] ?? 0);
    const built = apply(state, input("build-glacier", 1));
    expect(iceFieldRules.earned(built)).toEqual([firstWin, firstGlacier]);
  });
});

describe("what a run has earned", () => {
  it("is first-win after a won board, first-glacier after a glacier, and each only once", () => {
    expect(iceFieldRules.earned(start())).toEqual([]);
    const won = apply(
      start(),
      input("pick", safeTiles(7, 0)[0] ?? 0),
      input("settle"),
    );
    expect(iceFieldRules.earned(won)).toEqual([firstWin]);
    expect(iceFieldRules.earned({ ...start(), glacierTier: 2 })).toEqual([
      firstGlacier,
    ]);
    expect(iceFieldRules.earned({ ...won, glacierTier: 1, wins: 5 })).toEqual([
      firstWin,
      firstGlacier,
    ]);
  });

  it("is never first-cashout: that is a simulation event the rules cannot decide", () => {
    for (const state of [start(), { ...start(), glacierTier: 3, wins: 9 }])
      expect(iceFieldRules.earned(state)).not.toContain("first-cashout");
  });
});

describe("inputs the game does not have", () => {
  it("are refused by name, never thrown on", () => {
    expect(refusal(start(), input("cashout"))).toBe("no such input: cashout");
    expect(refusal(start(), input("fly", 3))).toBe("no such input: fly");
  });

  it("never throw, whatever is fed to them", () => {
    const junk: JsonValue[] = [
      null,
      0,
      -1,
      1e9,
      "x",
      [],
      [1, 2],
      {},
      { a: { b: [null] } },
      true,
    ];
    let state = start(3);
    for (let n = 0; n < 300; n += 1) {
      const type = ["pick", "settle", "build-glacier", "zzz"][n % 4] ?? "pick";
      const stepped = iceFieldRules.step(
        state,
        input(type, junk[n % junk.length]),
      );
      if (stepped.ok) state = stepped.state;
    }
    expect(state.boardIndex).toBeLessThan(maxBoards);
  });
});
