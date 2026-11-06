import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildGames } from "@frostbite/game-sdk/build";
import { chromium, devices, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serveGame } from "../src/game-hosting.ts";
import { controlProblems, measureControls } from "../src/game-controls.ts";
import {
  layoutDifferences,
  parseSavedLayouts,
} from "../src/game-layout-compare.ts";
import {
  measureCard,
  measureLayout,
  type Card,
  type GameLayout,
} from "../src/game-layout.ts";

// Every game is built, served and measured in a browser, at a phone's two sizes of frame and at two desktop sizes.
//  - On a phone the page must not scroll, and the screen must take the frame.
//  - On a desktop the place of every named part must be what `fixtures/games-desktop-layout.json` holds, give or take the room a font takes
//    (`layoutTolerancePx`: exact pixels passed on the machine that recorded them and failed on CI), so a change made for phones cannot move
//    anything there. A change meant for desktops is made on purpose: `UPDATE_GAME_LAYOUT=1 pnpm test:integration` writes the new places.
const gamesDirectory = resolve(import.meta.dirname, "../../../games");
const fixture = resolve(
  import.meta.dirname,
  "../fixtures/games-desktop-layout.json",
);
const update = process.env.UPDATE_GAME_LAYOUT === "1";
// Not games played on a screen of their own: a developer tool, the original cabinets, which draw into a page of their own at run time, and the
// fixture game, a plain starter page that exists so that tests have "a game" (it is not made to fit a phone, and a change to make it so would
// change every test that uses it).
const skipped = new Set(["sdk-explorer", "fixture-taps"]);

// The frame the platform gives a game on an iPhone 13 held upright and on its side (measured in the platform's own page).
const phones = [
  { height: 520, name: "portrait", width: 390 },
  { height: 198, name: "landscape", width: 750 },
] as const;
// The same phone with the platform's bar out of the way (the whole window, which is what playing full screen gives), as it is held.
const phonesFull = [
  { height: 760, name: "portrait full screen", width: 390 },
  { height: 360, name: "landscape full screen", width: 750 },
] as const;
const desktops = [
  { height: 800, name: "1280x800", width: 1280 },
  { height: 900, name: "1440x900", width: 1440 },
] as const;

let browser: Browser;
let outRoot: string;
let names: string[] = [];

beforeAll(async () => {
  outRoot = await mkdtemp(join(tmpdir(), "games-layout-"));
  names = (await buildGames({ gamesDirectory, outRoot })).filter(
    (name) => !skipped.has(name),
  );
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser.close();
  await rm(outRoot, { force: true, recursive: true });
});

async function layoutOf(
  name: string,
  size: { readonly height: number; readonly width: number },
  touch: boolean,
): Promise<GameLayout> {
  const hosted = await serveGame(join(outRoot, name));
  const context = await browser.newContext(
    touch ? { ...devices["iPhone 13"], viewport: size } : { viewport: size },
  );
  try {
    const page = await context.newPage();
    await page.goto(hosted.url, { waitUntil: "load" });
    await page.waitForTimeout(800);
    return await measureLayout(page);
  } finally {
    await context.close();
    await hosted.close();
  }
}

describe("on a phone", () => {
  for (const size of phones) {
    it(`${size.name}: no game scrolls, and the screen takes the frame`, async () => {
      const problems: string[] = [];
      for (const name of names) {
        const layout = await layoutOf(name, size, true);
        if (layout.scrollHeight > layout.clientHeight)
          problems.push(
            `${name} scrolls down by ${String(layout.scrollHeight - layout.clientHeight)}px`,
          );
        if (layout.scrollWidth > layout.clientWidth)
          problems.push(`${name} scrolls sideways`);
        const canvas = layout.canvas;
        const wide = canvas === null ? 0 : canvas.w / layout.clientWidth;
        const tall = canvas === null ? 0 : canvas.h / layout.clientHeight;
        // A board that is square cannot be as wide as the frame and have the buttons under it, so for it the height counts.
        if (size.name === "portrait" ? wide < 0.9 && tall < 0.45 : tall < 0.6)
          problems.push(
            `${name}'s screen is ${String(canvas?.w)}x${String(canvas?.h)} in ${String(size.width)}x${String(size.height)}`,
          );
      }
      expect(problems).toEqual([]);
    }, 180_000);
  }
});

describe("on a touch screen the page is played with the screen, and what is left to press is a few small icons", () => {
  for (const size of [...phones, ...phonesFull]) {
    it(`${size.name}: no more than three icons, each a thumb wide, none on another or on the readouts`, async () => {
      const problems: string[] = [];
      for (const name of names) {
        const hosted = await serveGame(join(outRoot, name));
        const context = await browser.newContext({
          ...devices["iPhone 13"],
          viewport: size,
        });
        try {
          const page = await context.newPage();
          await page.goto(hosted.url, { waitUntil: "load" });
          await page.waitForTimeout(800);
          for (const problem of controlProblems(
            await measureControls(page),
            size,
          ))
            problems.push(`${name}: ${problem}`);
        } finally {
          await context.close();
          await hosted.close();
        }
      }
      expect(problems).toEqual([]);
    }, 180_000);
  }
});

describe("on a desktop", () => {
  it("every named part of every game is where it was", async () => {
    const found: Record<string, GameLayout["boxes"]> = {};
    for (const size of desktops)
      for (const name of names)
        found[`${name}@${size.name}`] = (
          await layoutOf(name, size, false)
        ).boxes;
    if (update) {
      await writeFile(fixture, `${JSON.stringify(found, null, 2)}\n`);
      return;
    }
    const saved = parseSavedLayouts(await readFile(fixture, "utf8"));
    expect(layoutDifferences(found, saved)).toEqual([]);
  }, 180_000);
});

// The games that draw a small screen (160x90 or 256x144) and scale it up lay a sharp card over it for the first screen's writing.
const smallScreens = ["bro-maria", "frost-runner", "tower-stack"];

describe("the first screen's writing", () => {
  it("is on a canvas of its own with a pixel for every pixel of the display, over the screen, before a run", async () => {
    const found: Record<string, Card | null> = {};
    for (const name of smallScreens) {
      const hosted = await serveGame(join(outRoot, name));
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        viewport: { height: 520, width: 390 },
      });
      try {
        const page = await context.newPage();
        await page.goto(hosted.url, { waitUntil: "load" });
        // Alone, with no platform to answer, a game draws its first screen when asking the platform gives up.
        await page
          .locator('canvas[aria-hidden="true"]')
          .waitFor({ state: "visible", timeout: 20_000 });
        found[name] = await measureCard(page);
      } finally {
        await context.close();
        await hosted.close();
      }
    }
    for (const name of smallScreens) {
      const card = found[name];
      expect(card, name).not.toBeNull();
      expect(card?.shown, name).toBe(true);
      expect(card?.cssWidth, name).toBe(card?.screenWidth);
      // The iPhone 13 has three display pixels to a page pixel.
      expect(card?.pixelWidth, name).toBe((card?.cssWidth ?? 0) * 3);
    }
  }, 120_000);
});
