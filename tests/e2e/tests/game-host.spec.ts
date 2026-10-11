import { expect, test } from "@playwright/test";

import { closeMatrix, skipToMain } from "./support/quality.ts";

// The sample game, Tap Tower, played in the platform's isolated frame: it connects, saves through the platform,
// unlocks milestones the platform remembers across a reload, and cannot reach the network, storage or cookies.
// The platform lists it only when run for tests or development.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/games/sample-game");
});

test("the game connects, and the platform remembers what it does across a reload", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
  for (let tap = 0; tap < 5; tap += 1) await game.locator("#tap").click();
  await expect(game.locator("#score")).toHaveText("5");
  // The platform, not the game, shows the milestone, and it is labelled as the game's own report.
  await expect(page.locator('[data-milestone="first-five"]')).toContainText(
    "reached",
  );
  await expect(page.locator('[data-milestone="ten-taps"]')).toContainText(
    "not yet",
  );
  await expect(page.getByText("reports these itself")).toBeVisible();
  // The score is saved a second after the last tap.
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("ador:game:sample-game:progress"),
      ),
    )
    .toBe('{"score":5}');

  await page.reload();
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
  await expect(game.locator("#score")).toHaveText("5");
  await expect(game.locator('[data-milestone="first-five"]')).toHaveCount(1);
  await expect(page.locator('[data-milestone="first-five"]')).toContainText(
    "reached",
  );
});

test("the game is cut off from the network, the platform's storage and its cookies", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
  await page.evaluate(() => {
    window.localStorage.setItem("platform-secret", "visible-to-the-page");
    document.cookie = "platform_marker=1; path=/";
  });
  await game.locator("#probe").click();
  await expect(game.locator("#probe-result")).toHaveText(
    "fetch: blocked\nlocalStorage: blocked\ncookie: blocked",
  );
});

test("the game's files are served sandboxed, with no network of their own, and only the platform may frame them", async ({
  request,
}) => {
  const response = await request.get("/play/sample-game/index.html");
  expect(response.status()).toBe(200);
  const policy = response.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("sandbox allow-scripts");
  expect(policy).not.toContain("allow-same-origin");
  expect(policy).toContain("connect-src 'none'");
  expect(policy).toContain("frame-ancestors 'self'");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect((await response.text()).includes("<script>")).toBe(false);
  expect((await request.get("/play/sample-game/main.js")).status()).toBe(200);
});

test("the game page closes the experience-quality matrix", async ({ page }) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
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
