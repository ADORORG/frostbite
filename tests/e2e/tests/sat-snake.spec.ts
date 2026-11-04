import { expect, test, type FrameLocator, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";
import { watch } from "./support/frame-watch.ts";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// The SAT SNAKE cabinet in FROST·BITE, played in the platform's isolated frame. It is real-time on the screen (a timer moves
// the snake) and replayable on the server (the record holds only the player's turns and the tick each was made on). The
// board's mines are random, so these steps keep to the rows around the start, which are always clear. Desktop only.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function openCabinet(game: FrameLocator) {
  await game.getByRole("button", { name: "Sat snake", exact: true }).click();
  await expect(
    game.getByRole("dialog", { name: "Sat snake cabinet" }),
  ).toBeVisible();
}

async function beginRun(game: FrameLocator) {
  await game.getByRole("button", { name: "Start a run" }).click();
  await expect(game.locator(".sn-cell")).toHaveCount(144);
}

async function startRun(game: FrameLocator) {
  await openCabinet(game);
  await beginRun(game);
}

const movesOf = (game: FrameLocator) =>
  game.locator(".if-stats div", { hasText: "Moves" }).locator("dd");

// Waits until the snake has made at least `moves` moves, on the screen's own timer.
async function waitForMoves(game: FrameLocator, moves: number) {
  const value = movesOf(game);
  await expect
    .poll(async () => Number(await value.textContent()))
    .toBeGreaterThanOrEqual(moves);
}

// Stops the page's clock, so the snake moves only when the test lets time pass. Done after the cabinet is open and before the run
// starts, so nothing is moving yet. A snake that moves on real time cannot be steered one move at a time on a busy machine: a pause
// of a second between two key presses is a few moves too many, and the row the test counts on being clear is left behind.
async function freezeClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1_000);
}

// Lets time pass in steps far shorter than a move, until the snake has made exactly `moves` moves. A step cannot jump over a move,
// so the count is never passed.
const clockStepMs = 20;
async function runUntilMoves(page: Page, game: FrameLocator, moves: number) {
  for (let step = 0; step < 100; step += 1) {
    if (Number(await movesOf(game).textContent()) >= moves) return;
    await page.clock.runFor(clockStepMs);
  }
  expect(Number(await movesOf(game).textContent())).toBe(moves);
}

test("signed out, it is played on its own seed and the record is not sent anywhere", async ({
  page,
}) => {
  const { errors, violations } = watch(page);
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  await startRun(game);
  await expect(game.locator(".if-status")).toContainText(
    "Sign in to have the platform check a run.",
  );
  await waitForMoves(game, 2);
  await game.getByRole("button", { name: "End run" }).click();
  await expect(game.locator(".if-note")).toContainText(
    "was not sent to the platform",
  );
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("signed in, the platform replays a run of steering and says it was checked", async ({
  baseURL,
  page,
}) => {
  const { errors, violations } = watch(page);
  await page.clock.install();
  await signIn(page, baseURL, creatorE2EFixtures.runPlayer);
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  await openCabinet(game);
  await freezeClock(page);
  await beginRun(game);
  await expect(game.locator(".if-status")).toContainText(
    "The platform will check this run when you end it.",
  );
  // Down into the next clear row with the keyboard, one move exactly, then along it with the pad: that row stays clear all the way round.
  await game.getByRole("dialog").press("ArrowDown");
  await runUntilMoves(page, game, 1);
  await game.getByRole("button", { name: "Turn right" }).click();
  await runUntilMoves(page, game, 4);
  await game.getByRole("button", { name: "End run" }).click();

  await expect(game.locator(".if-record")).toContainText("3 steps");
  await expect(game.locator(".if-note")).toContainText(
    "The platform checked this run. It earned no milestone.",
  );
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("a snake that turns back on itself is told no, and the turn is not recorded", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  await startRun(game);
  await game.getByRole("button", { name: "Turn left" }).click();
  await expect(game.locator(".if-status")).toContainText(
    "the snake cannot turn back on itself",
  );
  await game.getByRole("button", { name: "End run" }).click();
  await expect(game.locator(".if-record")).toContainText("1 steps");
});

test("looks like part of the game when opened", async ({ page }) => {
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  const launcher = game.getByRole("button", { name: "Sat snake", exact: true });
  await launcher.click();
  const panel = game.getByRole("dialog", { name: "Sat snake cabinet" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveScreenshot("sat-snake-intro.png", {
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(launcher).toBeFocused();
});
