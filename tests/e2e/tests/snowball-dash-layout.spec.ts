import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { expect, test, type FrameLocator } from "@playwright/test";

// Snowball Dash is played against the clock, so nothing under the player's thumb may move while it runs: the screen, the controls, the note
// and the list of what was earned keep the same boxes before a run, during it (as milestones are earned and listed), and after it ends.
const frameSelector = '[data-testid="game-frame"]';
const watched = [
  "#screen",
  "#start",
  "#pause",
  "#note",
  "#earned",
  "#sound",
  ".bar",
] as const;
// On a desktop the foot is a box of its own that holds the controls in place; on a phone the shared phone layout gives it no box (its parts sit
// in rows of their own, each watched above).
const desktopOnly = [".foot"] as const;

// On a touch screen (whatever the size of the window) the shared phone layout hides the Start button, the note and the list earned: what is
// watched there is what has a box, since a hidden control (or one the layout gives no box of its own) is not a place anything can move from.
async function shownControls(game: FrameLocator, desktop: boolean) {
  const shown: string[] = [];
  for (const selector of desktop ? [...watched, ...desktopOnly] : watched)
    if ((await game.locator(selector).boundingBox()) !== null)
      shown.push(selector);
  return shown;
}

async function boxes(game: FrameLocator, shown: readonly string[]) {
  const found: Record<
    string,
    { height: number; width: number; x: number; y: number }
  > = {};
  for (const selector of shown) {
    const box = await game.locator(selector).boundingBox();
    if (box === null) throw new Error(`${selector} has no box`);
    found[selector] = box;
  }
  return found;
}

for (const size of [
  { height: 720, name: "desktop", width: 1100 },
  { height: 780, name: "phone", width: 390 },
] as const)
  test(`the screen and the controls stay where they are through a whole run (${size.name})`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: size.height, width: size.width });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/games/snowball-dash");
    const game = page.frameLocator(frameSelector);
    await expect(game.locator("#status")).toHaveText("Connected.");
    const shown = await shownControls(game, size.name === "desktop");
    // The screen is always there; a layout that showed nothing would make this test watch nothing.
    expect(shown).toContain("#screen");
    const buttons = shown.includes("#start");
    const before = await boxes(game, shown);
    if (buttons) await game.locator("#start").click();
    else {
      // With no Start button in sight a tap on the screen starts the run, once the button has been on offer for a moment.
      await page.waitForTimeout(restartDelayMs + 100);
      await game.locator("#screen").tap();
    }
    await expect(game.locator("#pause")).toBeEnabled();
    expect(await boxes(game, shown)).toEqual(before);
    // One hop earns the first milestone, which is listed: the list gains an item and nothing around it moves.
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await expect(game.locator("#earned li")).not.toHaveCount(0);
    expect(await boxes(game, shown)).toEqual(before);
    // Hop no more: the snowball meets the first rock and the run ends with the card on the screen.
    await expect(game.locator("#pause")).toBeDisabled({ timeout: 15_000 });
    await expect(game.locator("#note")).not.toHaveText("");
    expect(await boxes(game, shown)).toEqual(before);
  });
