// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { mountIceField } from "../src/ice-field/mount.tsx";
import { randomSeed } from "../src/ice-field/seed.ts";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("mounting the cabinet on the page", () => {
  it("adds a root of its own with the launcher, and takes it away again", async () => {
    let unmount = () => {};
    await act(async () => {
      unmount = mountIceField({ milestone: () => undefined });
    });
    expect(document.getElementById("ice-field-root")?.textContent).toBe(
      "Ice field",
    );
    expect(document.body.children).toHaveLength(1);
    await act(async () => unmount());
    expect(document.getElementById("ice-field-root")).toBeNull();
  });

  it("plays with the seed it is given", async () => {
    const newSeed = vi.fn(() => 42);
    let unmount = () => {};
    await act(async () => {
      unmount = mountIceField({ milestone: () => undefined }, { newSeed });
    });
    const click = (label: string) =>
      act(async () => {
        [...document.querySelectorAll("button")]
          .find((b) => b.textContent === label)
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    await click("Ice field");
    await click("Start a run");
    expect(newSeed).toHaveBeenCalledTimes(1);
    await act(async () => unmount());
  });
});

describe("a fresh seed", () => {
  it("is a whole number of 32 bits, from the browser's own randomness", () => {
    for (let n = 0; n < 50; n += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
    expect(
      new Set(Array.from({ length: 50 }, randomSeed)).size,
    ).toBeGreaterThan(45);
  });

  it("is what the browser's generator gave", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((
      array: Uint32Array,
    ) => {
      array[0] = 123_456;
      return array;
    }) as never);
    expect(randomSeed()).toBe(123_456);
  });
});
