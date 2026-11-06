import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";

import { playerGames } from "../src/player-games.ts";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// What every game on the platform does the same way, checked on every game there is, on every project (the phone profile included): a game
// joins by having a folder under `games/` (src/player-games.ts), and needs no spec of its own to get these. Only the page parts the SDK
// gives a game are named here: its screen (`canvas#screen`), `#pause`, which is enabled exactly while a run is in progress, and buttons.
const frameSelector = '[data-testid="game-frame"]';
// A game draws on a small canvas that the page scales up, which blurs writing on it, so its first-screen card is a canvas of its own at the
// pixels of the display. Checked at twice the usual density, where a card drawn on the small canvas is visibly soft.
const ratio = 2;
test.use({ deviceScaleFactor: ratio });
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// Opens a game and waits until it has greeted the platform.
async function open(page: Page, id: string): Promise<FrameLocator> {
  await page.goto(`/games/${id}`);
  await expectConnectedToPlatform(page);
  return page.frameLocator(frameSelector);
}

// Starts a run the way the player's device does: a tap on the screen where there is a touch screen, Enter where there is a keyboard.
async function start(page: Page, touch: boolean): Promise<void> {
  if (!touch) {
    await page.keyboard.press("Enter");
    return;
  }
  // A tap starts a run only once the Start button has been on offer for a moment (the tap that ends a run must not start the next).
  await page.waitForTimeout(restartDelayMs + 100);
  const box = await page.locator(frameSelector).boundingBox();
  if (box === null) throw new Error("The game frame has no box");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

interface Layer {
  readonly cssWidth: number;
  readonly pixels: number;
  readonly shown: boolean;
}

// The first-screen card's own canvas: the one the SDK lays over the screen, fixed in place. Null when the game has none.
const cardOf = (frame: FrameLocator) =>
  frame.locator("body").evaluate((): Layer | null => {
    const layer = [...document.querySelectorAll("canvas")].find(
      (canvas) => getComputedStyle(canvas).position === "fixed",
    );
    if (layer === undefined) return null;
    return {
      cssWidth: layer.getBoundingClientRect().width,
      pixels: layer.width,
      shown: getComputedStyle(layer).display !== "none",
    };
  });

// The place of every control and of the screen, in the order they come: where a thumb is put, so where nothing may move to. A part with no
// box (the phone layout hides some controls) is not a place anything can move from, so it is left out; a part that loses its box is a move.
const placesOf = (frame: FrameLocator) =>
  frame.locator("body").evaluate(() => {
    const parts = document.querySelectorAll(
      'canvas:not([aria-hidden="true"]), button',
    );
    return [...parts].flatMap((part, index) => {
      const { height, left, top, width } = part.getBoundingClientRect();
      return width === 0 && height === 0
        ? []
        : [{ height, index, left, name: part.id || part.tagName, top, width }];
    });
  });

for (const id of await playerGames())
  test.describe(id, () => {
    test("the first Tab is the skip link, with the game connected", async ({
      page,
    }) => {
      await open(page, id);
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Skip to main content" }),
      ).toBeFocused();
    });

    test("a run starts from the player's own device, and the card on the screen goes", async ({
      hasTouch,
      page,
    }) => {
      const frame = await open(page, id);
      const hasCard = (await cardOf(frame)) !== null;
      await start(page, hasTouch);
      await expect(frame.locator("#pause")).toBeEnabled();
      if (hasCard)
        await expect.poll(() => cardOf(frame)).toMatchObject({ shown: false });
    });

    test("a game drawn on a screen of its own has a first-screen card with the display's pixels", async ({
      page,
    }) => {
      const frame = await open(page, id);
      test.skip(
        (await frame.locator("canvas#screen").count()) === 0,
        "This game is drawn in page elements, not on a screen of its own.",
      );
      await expect.poll(() => cardOf(frame)).toMatchObject({ shown: true });
      const card = await cardOf(frame);
      expect(card?.cssWidth).toBeGreaterThan(100);
      expect(card?.pixels).toBeGreaterThanOrEqual(
        Math.round((card?.cssWidth ?? 0) * ratio) - 1,
      );
    });

    test("nothing the player touches moves when a run starts, or in its first seconds", async ({
      hasTouch,
      page,
    }) => {
      const frame = await open(page, id);
      const before = await placesOf(frame);
      // The screen is always there; a layout that showed nothing would make this test watch nothing.
      expect(before.length).toBeGreaterThan(0);
      await start(page, hasTouch);
      await expect(frame.locator("#pause")).toBeEnabled();
      expect(await placesOf(frame)).toEqual(before);
      await page.waitForTimeout(1_500);
      expect(await placesOf(frame)).toEqual(before);
    });
  });
