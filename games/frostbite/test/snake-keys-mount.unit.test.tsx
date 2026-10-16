// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { directionOfKey } from "../src/snake/keys.ts";
import { mountSatSnake } from "../src/snake/mount.tsx";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  document.body.replaceChildren();
});

describe("the keys that steer", () => {
  it.each([
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["w", "up"],
    ["a", "left"],
    ["s", "down"],
    ["d", "right"],
    ["W", "up"],
    ["D", "right"],
  ])("%s steers %s", (key, direction) => {
    expect(directionOfKey(key)).toBe(direction);
  });

  it.each([
    "x",
    "Enter",
    " ",
    "toString",
    "constructor",
    "__proto__",
    "arrowup",
  ])("%j steers nothing", (key) => {
    expect(directionOfKey(key)).toBeUndefined();
  });
});

describe("mounting SAT SNAKE on the page", () => {
  it("adds a root of its own with the launcher, and takes it away again", async () => {
    let unmount = () => {};
    await act(async () => {
      unmount = mountSatSnake({ milestone: () => undefined });
    });
    expect(document.getElementById("sat-snake-root")?.textContent).toBe(
      "Sat snake",
    );
    await act(async () => unmount());
    expect(document.getElementById("sat-snake-root")).toBeNull();
  });

  it("plays with the seed and the pace it is given", async () => {
    const newSeed = vi.fn(() => 42);
    let unmount = () => {};
    await act(async () => {
      unmount = mountSatSnake(
        { milestone: () => undefined },
        { newSeed, tickMs: 50 },
      );
    });
    const click = (label: string) =>
      act(async () => {
        [...document.querySelectorAll("button")]
          .find((b) => b.textContent === label)
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    await click("Sat snake");
    await click("Start a run");
    expect(newSeed).toHaveBeenCalledTimes(1);
    await act(async () => unmount());
  });
});
