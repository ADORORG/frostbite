// @vitest-environment jsdom

import { ScenesProvider } from "@ador/scenes/react";
import { scenes } from "@ador/scenes/library";
import { click, mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { homeCopy } from "../src/domain/home-copy.ts";
import { HomeHero } from "../src/ui/home-hero.tsx";

const hero = (over: Partial<Parameters<typeof HomeHero>[0]> = {}) =>
  mount(
    <ScenesProvider>
      <HomeHero hasCollections hasGames hasLaunches {...over} />
    </ScenesProvider>,
  );
const playing = (container: HTMLElement) =>
  container.querySelector(".home-cabinet__name")?.textContent;
const pick = (container: HTMLElement, label: string) =>
  click(container.querySelector(`button[aria-label="${label}"]`));

describe("the landing page's hero", () => {
  it("says what it is in one smaller headline, and only what is true of the platform", async () => {
    const container = await hero();
    expect(container.querySelector("h1")?.textContent).toContain(
      homeCopy.headline.first,
    );
    expect(container.querySelector("h1")?.textContent).toContain(
      homeCopy.headline.second,
    );
    // Nothing about the build, the feature count or what is gated: a visitor is told what to do, not how the platform is doing.
    expect(textOf(container)).toContain(homeCopy.lede);
    expect(textOf(container)).not.toMatch(/registered|gated|foundation/iu);
  });

  it("links only to what is registered", async () => {
    const all = await hero();
    expect(
      [...all.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    ).toEqual(["/games", "/collections", "/launches"]);
    const none = await hero({
      hasCollections: false,
      hasGames: false,
      hasLaunches: false,
    });
    expect(none.querySelectorAll("a")).toHaveLength(0);
  });

  it("plays one scene, names it, and steps to the next and the one before, round the whole list", async () => {
    const container = await hero();
    const first = playing(container);
    expect(scenes.map(({ name }) => name)).toContain(first);
    const at = scenes.findIndex(({ name }) => name === first);
    pick(container, homeCopy.pickNext);
    await Promise.resolve();
    expect(playing(container)).toBe(scenes[(at + 1) % scenes.length]?.name);
    pick(container, homeCopy.pickPrevious);
    pick(container, homeCopy.pickPrevious);
    await Promise.resolve();
    expect(playing(container)).toBe(
      scenes[(at - 1 + scenes.length) % scenes.length]?.name,
    );
  });

  it("keeps the words and the scene apart: snow falls behind the words, and the playing scene is on a screen beside them", async () => {
    const container = await hero();
    const sky = container.querySelector(".home-hero__sky");
    expect(sky?.getAttribute("aria-hidden")).toBe("true");
    expect(
      sky?.querySelector(".scene-backdrop")?.getAttribute("data-scene"),
    ).toBe("snowfall");
    const screen = container.querySelector(".home-cabinet__screen");
    expect(screen?.getAttribute("aria-hidden")).toBe("true");
    expect(screen?.querySelector(".scene-backdrop")).not.toBeNull();
    // The screen plays what a person can pick, and never the page's own weather.
    expect(screen?.querySelector("[data-scene='snowfall']")).toBeNull();
    // The words are in neither: they sit in their own column, so no scene is ever drawn behind them.
    const copy = container.querySelector(".home-hero__copy");
    expect(copy?.querySelector(".scene-backdrop")).toBeNull();
    expect(copy?.querySelector("h1")).not.toBeNull();
  });

  it("is a named region with a screen of decoration that screen readers skip", async () => {
    const container = await hero();
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Welcome",
    );
    for (const decoration of container.querySelectorAll(
      ".home-hero__shade, .home-hero__crt, .home-hero__cursor, .scene-backdrop",
    ))
      expect(decoration.getAttribute("aria-hidden")).toBe("true");
  });
});
