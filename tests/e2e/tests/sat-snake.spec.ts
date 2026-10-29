import { expect, test, type FrameLocator } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";
import { watch } from "./support/frame-watch.ts";

// The SAT SNAKE cabinet in FROST·BITE, played in the platform's isolated frame. It is real-time on the screen (a timer moves
// the snake) and replayable on the server (the record holds only the player's turns and the tick each was made on). The
// board's mines are random, so these steps keep to the rows around the start, which are always clear. Desktop only.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function startRun(game: FrameLocator) {
  await game.getByRole("button", { name: "Sat snake", exact: true }).click();
  await expect(
    game.getByRole("dialog", { name: "Sat snake cabinet" }),
  ).toBeVisible();
  await game.getByRole("button", { name: "Start a run" }).click();
  await expect(game.locator(".sn-cell")).toHaveCount(144);
}

// Waits until the snake has made at least `moves` moves, on the screen's own timer.
async function waitForMoves(game: FrameLocator, moves: number) {
  const value = game
    .locator(".if-stats div", { hasText: "Moves" })
    .locator("dd");
  await expect
    .poll(async () => Number(await value.textContent()))
    .toBeGreaterThanOrEqual(moves);
}

test("signed out, it is played on its own seed and the record is not sent anywhere", async ({
  page,
}) => {
  const { errors, violations } = watch(page);
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
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
  await signIn(page, baseURL, creatorE2EFixtures.runPlayer);
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const game = page.frameLocator(frameSelector);
  await startRun(game);
  await expect(game.locator(".if-status")).toContainText(
    "The platform will check this run when you end it.",
  );
  // Down into the next clear row with the keyboard, then along it with the pad: that row stays clear all the way round.
  await game.getByRole("dialog").press("ArrowDown");
  await waitForMoves(game, 1);
  await game.getByRole("button", { name: "Turn right" }).click();
  await waitForMoves(game, 4);
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
  await expect(page.getByText("Connected to the platform")).toBeVisible();
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
  await expect(page.getByText("Connected to the platform")).toBeVisible();
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
