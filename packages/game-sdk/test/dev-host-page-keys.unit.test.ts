// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { mount, state, useDevPage } from "./dev-host-page-harness.ts";

useDevPage();

const press = (type: "keydown" | "keyup", code: string) => {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
  });
  document.dispatchEvent(event);
  return event;
};

// While a game is built, a key pressed before clicking into its frame must reach it as on the platform's page (key.forwarded), or a
// game that listens for keys looks broken on the test page.
describe("keys on the test page", () => {
  it("passes a key pressed with nothing focused on to the game, and keeps the page from scrolling for Space", async () => {
    const { ask, pushed } = mount();
    await ask("ready", { sdkVersion: 1 });
    expect(press("keydown", "Space").defaultPrevented).toBe(true);
    press("keyup", "Space");
    expect(
      pushed().filter(({ event }) => event === "key.forwarded"),
    ).toMatchObject([
      { data: { code: "Space", phase: "down", repeat: false } },
      { data: { code: "Space", phase: "up", repeat: false } },
    ]);
  });

  it("stops passing keys on when the page is taken down", async () => {
    const { ask, pushed } = mount();
    await ask("ready", { sdkVersion: 1 });
    state.page?.dispose();
    press("keydown", "KeyW");
    expect(pushed().some(({ event }) => event === "key.forwarded")).toBe(false);
  });
});
