import { describe, expect, it } from "vitest";

import { createReadCache } from "../src/index.ts";

describe("a read cache under real concurrent callers and real time", () => {
  it("asks the upstream once for a crowd, serves the old reading while the next is taken, and falls back to the old reading when that one fails", async () => {
    let asked = 0;
    let failNext = false;
    const ask = async () => {
      asked += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (failNext) throw new Error("down");
      return asked;
    };
    const readings = createReadCache<number>({
      now: () => new Date(),
      policy: { freshMs: 60, maxStaleMs: 5_000 },
    });
    const crowd = await Promise.all(
      Array.from({ length: 200 }, () => readings.read("a", ask)),
    );
    expect(new Set(crowd.map(({ value }) => value))).toEqual(new Set([1]));
    expect(asked).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 70));
    failNext = true;
    const during = await Promise.all(
      Array.from({ length: 200 }, () => readings.read("a", ask)),
    );
    expect(new Set(during.map(({ value }) => value))).toEqual(new Set([1]));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(asked).toBe(2);
    expect((await readings.read("a", ask)).value).toBe(1);
  });
});
