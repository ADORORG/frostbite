import { describe, expect, it } from "vitest";

import { maxKeysPerInput } from "../src/rules/constants.ts";
import { encodeKey, readKeys } from "../src/rules/keys.ts";

describe("a run's keys, written compactly", () => {
  it("reads a gap and a letter for each key, and nothing for no gap", () => {
    expect(readKeys("12l3r0a")).toEqual([
      { action: "left", gap: 12 },
      { action: "right", gap: 3 },
      { action: "turnRight", gap: 0 },
    ]);
    expect(readKeys("d")).toEqual([{ action: "hard", gap: 0 }]);
    expect(readKeys("")).toEqual([]);
  });

  it("knows all eight keys", () => {
    const keys = readKeys("lrabdhsS");
    expect(
      Array.isArray(keys) ? keys.map(({ action }) => action) : keys,
    ).toEqual([
      "left",
      "right",
      "turnRight",
      "turnLeft",
      "hard",
      "hold",
      "softOn",
      "softOff",
    ]);
  });

  it("writes what it reads", () => {
    const text = "12l3r0a40b7d0h5s99S";
    const keys = readKeys(text);
    expect(typeof keys).toBe("object");
    expect(Array.isArray(keys) && keys.map(encodeKey).join("")).toBe(
      text.replace("0a", "a").replace("0h", "h"),
    );
  });

  it("refuses what is not keys, and says why", () => {
    expect(readKeys(5)).toBe("keys must be text");
    expect(readKeys("12x")).toBe("no such key: x");
    expect(readKeys("1 l")).toBe("no such key:  ");
    expect(readKeys("12")).toBe("the keys end with a gap and no key");
    expect(readKeys("123456l")).toBe("a gap is at most five digits");
    expect(readKeys("-3l")).toBe("no such key: -");
  });

  it("holds as many keys as one input may, and no more", () => {
    expect(readKeys("l".repeat(maxKeysPerInput))).toHaveLength(maxKeysPerInput);
    expect(readKeys("l".repeat(maxKeysPerInput + 1))).toBe(
      `at most ${String(maxKeysPerInput)} keys in one input`,
    );
  });
});
