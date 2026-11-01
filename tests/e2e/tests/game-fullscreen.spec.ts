import { expect, test } from "@playwright/test";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// The player's full screen button on the game panel, in a real browser: it is offered exactly where the browser
// allows full screen, takes the game's frame (not the page) full screen, leaves it again, and the game keeps
// working while it is full screen.
const frameSelector = '[data-testid="game-frame"]';
const fullscreenElement = () =>
  document.fullscreenElement?.getAttribute("data-testid") ?? null;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/games/sdk-explorer");
  await expectConnectedToPlatform(page);
});

test("the button is offered where the browser allows full screen, and only there", async ({
  page,
}) => {
  const allowed = await page.evaluate(() => document.fullscreenEnabled);
  await expect(page.getByRole("button", { name: "Full screen" })).toHaveCount(
    allowed ? 1 : 0,
  );
});

test("the game's frame goes full screen from the button, keeps working, and the browser's own exit brings the page back", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => document.fullscreenEnabled)),
    "This browser does not allow full screen.",
  );
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  // Hidden on a touch screen, where there is no Escape key to press.
  await expect(
    page.getByText("Press Esc to leave full screen."),
  ).toBeAttached();
  await page.getByRole("button", { name: "Full screen" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(fullscreenElement)).toBe("game-frame");
  // The game is playable while it fills the screen.
  await game.locator("#progress-save").click();
  await expect(game.locator("#log li").first()).toHaveText(
    'progress.save → {"saved":{"calls":1}}',
  );
  // Leaving is the browser's: the frame covers the page, so the page has nothing to click.
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(fullscreenElement)).toBeNull();
  await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
  // The host's exit event may land after the save, so the line is looked for rather than taken as the newest.
  await expect(
    game.locator("#log li", { hasText: "progress.save" }),
  ).toHaveText('progress.save → {"saved":{"calls":1}}');
});
