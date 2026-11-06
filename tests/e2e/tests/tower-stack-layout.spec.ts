import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { expect, test, type FrameLocator } from "@playwright/test";

// Tower Stacker is played against the clock, so nothing under the player's thumb may move while it runs: the controls,
// the screen and the lists keep the same boxes before a run, during it, and after it ends with a note on the screen.
const frameSelector = '[data-testid="game-frame"]';
// On a touch screen the shared phone layout hides the Drop and Start buttons (a tap on the screen plays), so what is watched there is what is
// shown: the box of a hidden control is not a place anything can move from.
const watched = ["#drop", "#start", "#screen", "#note", "#earned"] as const;

async function shownControls(game: FrameLocator) {
  const shown: (typeof watched)[number][] = [];
  for (const selector of watched)
    if ((await game.locator(selector).boundingBox()) !== null)
      shown.push(selector);
  return shown;
}

async function boxes(
  game: FrameLocator,
  selectors: readonly (typeof watched)[number][],
) {
  const found: Record<
    string,
    { height: number; width: number; x: number; y: number }
  > = {};
  for (const selector of selectors) {
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
  const shown = await shownControls(game);
  // The screen and the note are always there; a phone must show at least them, or the test would watch nothing.
  expect(shown).toContain("#screen");
  const buttons = shown.includes("#start");
  const before = await boxes(game, shown);
  // A button is clicked; on a touch screen, with no button in sight, a tap on the screen starts the run and drops the block.
  const press = async (button: "#drop" | "#start") =>
    buttons
      ? game
          .locator(button)
          .click({ force: true, timeout: 2_000 })
          .catch(() => undefined)
      : game
          .locator("#screen")
          .tap({ force: true, timeout: 2_000 })
          .catch(() => undefined);
  // A tap starts a run only once the Start button has been on offer for a moment (the tap that ends a run must not start the next).
  if (!buttons) await page.waitForTimeout(restartDelayMs + 100);
  await press("#start");
  await expect(game.locator("#pause")).toBeEnabled();
  expect(await boxes(game, shown)).toEqual(before);
  // Drop at once, again and again: the tower grows and the run soon ends.
  for (let drops = 0; drops < 400; drops += 1) {
    if (await game.locator("#pause").isDisabled()) break;
    await press("#drop");
  }
  await expect(game.locator("#pause")).toBeDisabled();
  await expect(game.locator("#note")).not.toHaveText("");
  expect(await boxes(game, shown)).toEqual(before);
});
