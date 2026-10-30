import { describe, expect, it } from "vitest";

import { worldSounds } from "../src/feedback.ts";
import { empty } from "./support/states.ts";

describe("the sounds of what the world did", () => {
  it("rings when a shard was taken, and is quiet otherwise", () => {
    const before = empty();
    expect(worldSounds(before, { ...before, shardsTaken: 1 })).toEqual([
      "shard",
    ]);
    expect(worldSounds(before, { ...before, shardsTaken: 3 })).toEqual([
      "shard",
    ]);
    expect(worldSounds(before, before)).toEqual([]);
    expect(
      worldSounds({ ...before, shardsTaken: 2 }, { ...before, shardsTaken: 2 }),
    ).toEqual([]);
  });
});
