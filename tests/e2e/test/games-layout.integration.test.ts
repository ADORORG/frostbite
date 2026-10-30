import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildGames } from "@ador/game-sdk/build";
import { chromium, devices, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serveGame } from "../src/game-hosting.ts";
import { measureLayout, type GameLayout } from "../src/game-layout.ts";

// Every game is built, served and measured in a browser, at a phone's two sizes of frame and at two desktop sizes.
//  - On a phone the page must not scroll, and the screen must take the frame.
//  - On a desktop the place of every named part must be what `fixtures/games-desktop-layout.json` holds, so a change made for phones cannot move
//    anything there. A change meant for desktops is made on purpose: `UPDATE_GAME_LAYOUT=1 pnpm test:integration` writes the new places.
const gamesDirectory = resolve(import.meta.dirname, "../../../games");
const fixture = resolve(
  import.meta.dirname,
  "../fixtures/games-desktop-layout.json",
);
const update = process.env.UPDATE_GAME_LAYOUT === "1";
// Not games played on a screen of their own: a developer tool, and the original cabinets, which draw into a page of their own at run time.
const skipped = new Set(["sdk-explorer"]);
const notPhoneChecked = new Set(["frostbite"]);

// The frame the platform gives a game on an iPhone 13 held upright and on its side (measured in the platform's own page).
const phones = [
  { height: 520, name: "portrait", width: 390 },
  { height: 198, name: "landscape", width: 750 },
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
      for (const name of names.filter((n) => !notPhoneChecked.has(n))) {
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
    const saved: unknown = JSON.parse(await readFile(fixture, "utf8"));
    expect(found).toEqual(saved);
  }, 180_000);
});
