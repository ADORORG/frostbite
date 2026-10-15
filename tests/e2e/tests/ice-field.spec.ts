import { expect, test } from "@playwright/test";

import { createVerifierRegistry } from "../../../packages/game-verification/src/registry.ts";
import { defineVerifier } from "../../../packages/game-verification/src/verifier.ts";
import { verifyRun } from "../../../packages/game-verification/src/verify.ts";
import { iceFieldRules } from "../../../games/frostbite/src/verifier/ice-field.ts";
import { iceFieldSampleRun } from "../../../games/frostbite/src/verifier/sample-run.ts";
import { openDock } from "./support/dock.ts";

// The ice-field cabinet in FROST·BITE, played in the platform's isolated frame: it plays through the platform's own rules,
// the platform records the milestone it reports (as the game's own claim), and the run record it leaves is accepted by the
// verifier the platform registered. Desktop only: the board is random, so these steps drive and assert it.
// FROST·BITE's rules as a verifier, built here from the rules themselves until the game publishes them as an artifact.
const verifierRegistry = createVerifierRegistry([
  {
    gameId: "frostbite",
    sample: iceFieldSampleRun(),
    verifier: defineVerifier(iceFieldRules),
  },
]);
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("is played in the real frame, the platform keeps the milestone, and the record it leaves is verified", async ({
  page,
}) => {
  const violations: string[] = [];
  const errors: string[] = [];
  page.on("console", (message) => {
    // The platform page reports one known thing, the wallet library's probe for script evaluation (see the hardening
    // spec); anything else the policy reports, in the page or the game's frame, is a failure.
    const text = message.text();
    if (
      /content security policy/iu.test(text) &&
      !/Evaluating a string as JavaScript/u.test(text)
    )
      violations.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const game = page.frameLocator(frameSelector);

  await game.getByRole("button", { name: "Ice field", exact: true }).click();
  const panel = game.getByRole("dialog", { name: "Ice field cabinet" });
  await expect(panel).toBeVisible();
  await game.getByRole("button", { name: "Start a run" }).click();
  await expect(game.locator(".if-tile")).toHaveCount(25);

  // The seed is random: pick a tile and settle, board after board, until one is won (a mine ends a board).
  const status = game.locator(".if-status");
  for (let board = 0; board < 40; board += 1) {
    await game.locator(".if-tile:not(:disabled)").first().click();
    await game.getByRole("button", { name: "Settle board" }).click();
    if (/^Board won/u.test((await status.textContent()) ?? "")) break;
  }
  await expect(status).toHaveText(/^Board won: \+\d+ icicles\.$/u);

  await game.getByRole("button", { name: "End run" }).click();
  await expect(game.getByText("your own claim today")).toBeVisible();
  const text = await game.locator(".if-record-text").inputValue();
  const result = verifyRun(verifierRegistry, JSON.parse(text));
  expect(result).toMatchObject({ earned: ["first-win"], status: "verified" });

  // The platform, not the game, shows the milestone, as the game's own report.
  await openDock(page, "Milestones");
  await expect(page.locator('[data-milestone="first-win"]')).toContainText(
    "Reached",
  );

  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("looks like part of the game when opened", async ({ page }) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const game = page.frameLocator(frameSelector);
  const launcher = game.getByRole("button", { name: "Ice field", exact: true });
  await launcher.click();
  const panel = game.getByRole("dialog", { name: "Ice field cabinet" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveScreenshot("ice-field-intro.png", {
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(launcher).toBeFocused();
});
