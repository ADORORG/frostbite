import { expect, test, type FrameLocator } from "@playwright/test";

// Tower Stacker is played against the clock, so nothing under the player's thumb may move while it runs: the controls,
// the screen and the lists keep the same boxes before a run, during it, and after it ends with a note on the screen.
const frameSelector = '[data-testid="game-frame"]';
const watched = ["#drop", "#start", "#screen", "#note", "#earned"] as const;

async function boxes(game: FrameLocator) {
  const found: Record<
    string,
    { height: number; width: number; x: number; y: number }
  > = {};
  for (const selector of watched) {
    const box = await game.locator(selector).boundingBox();
    if (box === null) throw new Error(`${selector} has no box`);
    found[selector] = box;
  }
  return found;
}

test("the controls and the screen stay where they are through a whole run", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/games/tower-stack");
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText("Connected.");
  const before = await boxes(game);
  await game.locator("#start").click();
  await expect(game.locator("#drop")).toBeEnabled();
  expect(await boxes(game)).toEqual(before);
  // Drop at once, again and again: the tower grows and the run soon ends.
  for (let drops = 0; drops < 400; drops += 1) {
    if (await game.locator("#start").isVisible()) break;
    await game
      .locator("#drop")
      .click({ force: true, timeout: 2_000 })
      .catch(() => undefined);
  }
  await expect(game.locator("#start")).toBeVisible();
  await expect(game.locator("#note")).not.toHaveText("");
  expect(await boxes(game)).toEqual(before);
});
