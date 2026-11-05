import { syncGameStateResponseSchema } from "@frostbite/shared/games";
import { expect, test, type FrameLocator } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";
import { openDock } from "./support/dock.ts";
import { watch } from "./support/frame-watch.ts";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// The ice-field cabinet in FROST·BITE, played in the platform's isolated frame. Signed out, it plays on a seed of its own and
// the milestone it earns is the game's own report. Signed in, the platform gives it a run and a seed, replays the record the
// run leaves, and the milestone is held as replay-checked on the account. Desktop only: the board is random, so these steps
// drive and assert it.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// Opens the cabinet and starts a run.
async function startRun(game: FrameLocator) {
  await game.getByRole("button", { name: "Ice field", exact: true }).click();
  await expect(
    game.getByRole("dialog", { name: "Ice field cabinet" }),
  ).toBeVisible();
  await game.getByRole("button", { name: "Start a run" }).click();
  await expect(game.locator(".if-tile")).toHaveCount(25);
}

// Picks a tile and settles, board after board, until one is won (a mine ends a board).
async function winABoard(game: FrameLocator) {
  const status = game.locator(".if-status");
  for (let board = 0; board < 40; board += 1) {
    await game.locator(".if-tile:not(:disabled)").first().click();
    await game.getByRole("button", { name: "Settle board" }).click();
    if (/^Board won/u.test((await status.textContent()) ?? "")) break;
  }
  await expect(status).toHaveText(/^Board won: \+\d+ icicles\.$/u);
}

test("signed out, it is played on its own seed and the milestone is the game's report", async ({
  page,
}) => {
  const { errors, violations } = watch(page);
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  await startRun(game);
  await expect(game.locator(".if-status")).not.toContainText("platform");
  await winABoard(game);
  await game.getByRole("button", { name: "End run" }).click();
  await expect(game.locator(".if-note")).toHaveCount(0);
  // The platform, not the game, shows the milestone, as the game's own report.
  await openDock(page, "Milestones");
  const milestone = page.locator('[data-milestone="first-win"]');
  await expect(milestone).toContainText("Reached");
  await expect(milestone).toContainText("Reported by the game");
  await expect(milestone).not.toContainText("Replay-checked");
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("signed in, the platform replays the run and holds the milestone as replay-checked", async ({
  baseURL,
  page,
}) => {
  const { errors, violations } = watch(page);
  await signIn(page, baseURL, creatorE2EFixtures.runPlayer);
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const game = page.frameLocator(frameSelector);
  await startRun(game);
  await winABoard(game);
  await expect(game.locator(".if-status")).not.toContainText("platform");

  await game.getByRole("button", { name: "End run" }).click();
  await expect(game.locator(".if-note")).toHaveCount(0);

  // The page shows the account's record: replay-checked, with what that does and does not show.
  await openDock(page, "Milestones");
  const milestone = page.locator('[data-milestone="first-win"]');
  await expect(milestone).toContainText("Replay-checked");
  await expect(milestone).toContainText("not that a person played it");
  // A milestone the rules cannot decide is never upgraded.
  await expect(
    page.locator('[data-milestone="first-cashout"]'),
  ).not.toContainText("Replay-checked");

  // The account holds it at that level, which a browser cannot set: another device is told the same.
  const synced = syncGameStateResponseSchema.parse(
    await (
      await page.request.post("/api/v1/games/sync", {
        data: {
          gameId: "frostbite",
          state: { counters: [], milestones: [], progress: null },
        },
        headers: { origin: new URL(baseURL ?? "").origin },
      })
    ).json(),
  );
  expect(
    synced.milestones.map(({ id, verification }) => [id, verification]),
  ).toContainEqual(["first-win", "replay-verified"]);

  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("a run is played once: the record of a run already settled is refused", async ({
  baseURL,
  page,
}) => {
  await signIn(page, baseURL, creatorE2EFixtures.runPlayer);
  const origin = new URL(baseURL ?? "").origin;
  const post = async (path: string, data: object) =>
    (
      await page.request.post(path, { data, headers: { origin } })
    ).json() as Promise<Record<string, unknown>>;
  const run = await post("/api/v1/games/runs/start", { gameId: "frostbite" });
  expect(run).toMatchObject({ status: "started" });
  // A record for another seed is rejected, and it spends the run.
  const submission = {
    gameId: "frostbite",
    record: {
      claims: [],
      config: { cabinet: "ice-field", mines: 5 },
      gameId: "frostbite",
      inputs: [],
      schemaVersion: 1,
      seed: 1,
      verifier: "frostbite",
      verifierVersion: 2,
    },
    runId: run.runId,
  };
  expect(await post("/api/v1/games/runs/submit", submission)).toEqual({
    reason: "seed-mismatch",
    status: "rejected",
  });
  expect(await post("/api/v1/games/runs/submit", submission)).toEqual({
    reason: "already-submitted",
    status: "refused",
  });
});

test("looks like part of the game when opened", async ({ page }) => {
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
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
