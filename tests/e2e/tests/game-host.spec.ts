import { expect, test } from "@playwright/test";

import { openDock } from "./support/dock.ts";
import { closeMatrix, skipToMain } from "./support/quality.ts";

// A game (the SDK explorer) played in the platform's isolated frame: it connects, saves through the platform,
// unlocks milestones the platform remembers across a reload, and cannot reach the network, storage or cookies.
// The platform lists it only when run for tests or development.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/games/sdk-explorer");
});

const connected = "Connected. Call anything below.";

test("the game connects, and the platform remembers what it does across a reload", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await expect(game.locator("#status")).toHaveText(connected);
  await game.locator("#progress-save").click();
  await expect(game.locator("#log li").first()).toHaveText(
    'progress.save → {"saved":{"calls":1}}',
  );
  await game.locator("#milestones-unlock").click();
  // The platform, not the game, shows the milestone, and it is labelled as the game's own report.
  await openDock(page, "Milestones");
  await expect(page.locator('[data-milestone="first-call"]')).toContainText(
    "Reached",
  );
  await expect(page.locator('[data-milestone="ten-presses"]')).toContainText(
    "Not yet",
  );
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "1 of 2 reached",
  );
  await expect(page.getByText("reports these itself")).toBeVisible();
  // The save is kept by the platform, a moment after the call.
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("ador:game:sdk-explorer:progress"),
      ),
    )
    .toBe('{"calls":1}');

  await page.reload();
  await expect(game.locator("#status")).toHaveText(connected);
  await game.locator("#progress-load").click();
  await expect(game.locator("#log li").first()).toHaveText(
    'progress.load → {"state":{"calls":1}}',
  );
  await expect(page.locator('[data-milestone="first-call"]')).toContainText(
    "Reached",
  );
});

test("the game is cut off from the network, the platform's storage and its cookies", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(connected);
  await page.evaluate(() => {
    window.localStorage.setItem("platform-secret", "visible-to-the-page");
    document.cookie = "platform_marker=1; path=/";
  });
  await game.locator("#sandbox").click();
  await expect(game.locator("#log li").first()).toHaveText(
    'sandbox check → {"cookie":"blocked","fetch":"blocked","localStorage":"blocked"}',
  );
});

test("the game's files are served sandboxed, with no network of their own, and only the platform may frame them", async ({
  request,
}) => {
  const response = await request.get("/play/sdk-explorer/index.html");
  expect(response.status()).toBe(200);
  const policy = response.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("sandbox allow-scripts");
  expect(policy).not.toContain("allow-same-origin");
  expect(policy).toContain("connect-src 'none'");
  expect(policy).toContain("frame-ancestors 'self'");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect((await response.text()).includes("<script>")).toBe(false);
  expect((await request.get("/play/sdk-explorer/main.js")).status()).toBe(200);
});

test("the game page closes the experience-quality matrix", async ({ page }) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(connected);
  await page
    .getByText(/^Declarations digest:/u)
    .evaluate(
      (node) => (node.textContent = "Declarations digest: 0000000000000000"),
    );
  // A page screenshot does not reliably include a frame's own picture, so the game's is checked on its own.
  await expect(page.locator(frameSelector)).toHaveScreenshot("game-frame.png", {
    animations: "disabled",
  });
  await skipToMain(page);
  await closeMatrix(page, "game-host.png");
});
