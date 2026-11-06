import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildGames } from "@frostbite/game-sdk/build";
import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { chromium, devices, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serveGame } from "../src/game-hosting.ts";

// Every game is played with a finger and nothing else: a tap on the screen of a game that is waiting starts a run. The Start run button is out
// of sight on a touch screen, so this is the only way in. Each game is built, served on its own and tapped in a browser with a touch screen.
const gamesDirectory = resolve(import.meta.dirname, "../../../games");
const games = [
  "aurora-pulse",
  "bro-maria",
  "frost-runner",
  "icicle-drop",
  "lantern-maze",
  "shard-match",
  "snowball-dash",
  "tower-stack",
];
const frame = { height: 360, width: 750 };

let browser: Browser;
let outRoot: string;

beforeAll(async () => {
  outRoot = await mkdtemp(join(tmpdir(), "games-touch-"));
  await buildGames({ gamesDirectory, outRoot });
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser.close();
  await rm(outRoot, { force: true, recursive: true });
});

describe("a tap on a waiting game", () => {
  for (const name of games) {
    it(`${name}: starts a run, and the Start run button is not on screen to do it`, async () => {
      const hosted = await serveGame(join(outRoot, name));
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        viewport: frame,
      });
      try {
        const page = await context.newPage();
        await page.goto(hosted.url, { waitUntil: "load" });
        // Ready (the game has finished looking for a platform) and waiting: Start run is enabled, out of sight, and nothing is running.
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLButtonElement>("#start")?.disabled ===
            false,
        );
        expect(await page.locator("#start").isVisible()).toBe(false);
        const running = (): Promise<boolean> =>
          page.evaluate(
            () =>
              document.querySelector<HTMLButtonElement>("#pause")?.disabled ===
              false,
          );
        expect(await running()).toBe(false);
        await page.waitForTimeout(restartDelayMs + 200);
        await page.touchscreen.tap(frame.width / 2, frame.height / 2);
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLButtonElement>("#pause")?.disabled ===
            false,
        );
        expect(await running()).toBe(true);
      } finally {
        await context.close();
        await hosted.close();
      }
    }, 30_000);
  }
});

// Bro Maria has no buttons on a touch screen: the screen is cut in three, and a thumb holds what is under it (the left quarter runs back, the
// next quarter runs forward, the right half jumps). Hold forward for a moment and the coins in the way are taken, which is on the score.
describe("a thumb on Bro Maria", () => {
  it("runs the hero forward while a thumb is held on the forward zone, with no drag needed", async () => {
    const hosted = await serveGame(join(outRoot, "bro-maria"));
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      viewport: frame,
    });
    try {
      const page = await context.newPage();
      await page.goto(hosted.url, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("#start")?.disabled ===
          false,
      );
      await page.waitForTimeout(restartDelayMs + 200);
      await page.touchscreen.tap(frame.width / 2, frame.height / 2);
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("#pause")?.disabled ===
          false,
      );
      const score = (): Promise<number> =>
        page.evaluate(() =>
          Number(document.querySelector("#score")?.textContent),
        );
      await page.waitForTimeout(1000);
      expect(await score()).toBe(0);
      const touch = await context.newCDPSession(page);
      // Forward is the second quarter of the screen's width.
      await touch.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: 1, x: frame.width * 0.375, y: frame.height * 0.6 }],
        type: "touchStart",
      });
      await page.waitForFunction(
        () => Number(document.querySelector("#score")?.textContent) > 0,
      );
      expect(await score()).toBeGreaterThan(0);
    } finally {
      await context.close();
      await hosted.close();
    }
  }, 60_000);
});
