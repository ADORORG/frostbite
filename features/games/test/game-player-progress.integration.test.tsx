// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  flush,
  game,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const counting = {
  ...game,
  milestones: [
    {
      claimPolicy: "once" as const,
      criteria: "Win ten boards.",
      description: "Ten wins.",
      id: "ten-wins",
      target: 10,
      title: "Ten wins",
    },
    {
      claimPolicy: "repeatable" as const,
      criteria: "Win a board.",
      description: "A win.",
      id: "a-win",
      maxCount: 3,
      title: "A win",
    },
  ],
};
const toast = () =>
  h.container.querySelector('[data-testid="milestone-toast"]')?.textContent;
const item = (id: string) =>
  h.container.querySelector(`[data-milestone="${id}"]`)?.textContent ?? "";

describe("progress toward a target, on the page", () => {
  it("shows the total the game reports, and says the milestone is reached when the total reaches the target", async () => {
    const { target } = await mount(undefined, { game: counting });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(item("ten-wins")).toContain("Not yet");
    send(target, "milestones.progress", { current: 7, id: "ten-wins" }, "b");
    await flush();
    expect(item("ten-wins")).toContain("7 of 10");
    expect(toast()).toBe("");
    send(target, "milestones.progress", { current: 10, id: "ten-wins" }, "c");
    await flush();
    expect(item("ten-wins")).toContain("Reached");
    expect(item("ten-wins")).not.toContain("7 of 10");
    expect(toast()).toBe("Ten wins reached");
  });
});

describe("a repeatable milestone, on the page", () => {
  it("announces each counting with its count, shows how often it was reported, and stops counting at the game's limit", async () => {
    const { target } = await mount(undefined, { game: counting });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    send(target, "milestones.unlock", { id: "a-win" }, "b");
    await flush();
    expect(toast()).toBe("A win reached");
    expect(item("a-win")).not.toContain("x2");
    send(target, "milestones.unlock", { id: "a-win" }, "c");
    await flush();
    expect(toast()).toBe("A win reached (x2)");
    expect(item("a-win")).toContain("Reached x2");
    for (const id of ["d", "e", "f"])
      send(target, "milestones.unlock", { id: "a-win" }, id);
    await flush();
    expect(toast()).toBe("A win reached (x3)");
    expect(item("a-win")).toContain("Reached x3");
    expect(item("a-win")).toContain("counted up to 3");
  });

  it("does not announce what the player already had when the game starts", async () => {
    window.localStorage.setItem(
      "frostbite:game:embedded-game:milestones",
      JSON.stringify({
        "a-win": {
          count: 2,
          unlockedAt: "2026-10-01T00:00:00.000Z",
          verification: "self-reported",
        },
      }),
    );
    const { target } = await mount(undefined, { game: counting });
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(toast()).toBe("");
    expect(item("a-win")).toContain("Reached x2");
  });
});
