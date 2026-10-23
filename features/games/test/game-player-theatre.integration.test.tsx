// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act } from "react";

import {
  harness as h,
  mount,
  registerHarness,
} from "./support/player-harness.tsx";

registerHarness();

const named = (label: string) =>
  [...h.container.querySelectorAll("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
const stage = () => h.container.querySelector<HTMLElement>(".arcade-stage");
const key = (name: string) =>
  act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: name }));
  });

describe("theatre on the game panel", () => {
  it("is offered whatever the browser says about full screen, and starts off", async () => {
    await mount();
    expect(named("Theatre")).toBeDefined();
    expect(stage()?.hasAttribute("data-theatre")).toBe(false);
    expect(document.documentElement.dataset["theatre"]).toBeUndefined();
  });

  it("gives the game the whole window, says how to leave, and leaves with the button", async () => {
    await mount();
    await act(async () => named("Theatre")?.click());
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
    expect(document.documentElement.dataset["theatre"]).toBe("true");
    expect(h.container.textContent).toContain("Press Esc to leave theatre.");
    expect(named("Theatre")).toBeUndefined();
    await act(async () => named("Leave theatre")?.click());
    expect(stage()?.hasAttribute("data-theatre")).toBe(false);
    expect(document.documentElement.dataset["theatre"]).toBeUndefined();
    expect(h.container.textContent).not.toContain("leave theatre");
  });

  it("leaves with Escape, and not with any other key", async () => {
    await mount();
    await act(async () => named("Theatre")?.click());
    await key("a");
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
    await key("Escape");
    expect(stage()?.hasAttribute("data-theatre")).toBe(false);
    expect(document.documentElement.dataset["theatre"]).toBeUndefined();
  });
});

describe("the bar over the game", () => {
  it("is one line: the way back's place, the title, the connection and the two ways to give the game room", async () => {
    await mount();
    const bar = h.container.querySelector(".arcade-stage__bar");
    expect(bar?.querySelector("h2")?.textContent).toBeTruthy();
    expect(
      bar?.querySelector(".arcade-stage__status .status-dot"),
    ).not.toBeNull();
    expect(bar?.querySelector(".arcade-stage__save")?.textContent).toBeTruthy();
    expect(
      bar?.querySelector(".arcade-stage__save")?.getAttribute("title"),
    ).toBe(bar?.querySelector(".arcade-stage__save")?.textContent);
    expect(named("Theatre")).toBeDefined();
  });

  it("says the platform is connected by words and by a light that turns from waiting to ready", async () => {
    await mount();
    const dot = () =>
      h.container.querySelector(".arcade-stage__status .status-dot");
    expect(
      h.container.querySelector(".arcade-stage__status")?.getAttribute("role"),
    ).toBe("status");
    expect(dot()?.className).toContain("status-dot--attention");
    expect(
      h.container.querySelector(".arcade-stage__status-text")?.textContent,
    ).toBe("Connecting");
  });
});
