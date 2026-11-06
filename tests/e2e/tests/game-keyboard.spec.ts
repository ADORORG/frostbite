import { expect, test, type FrameLocator } from "@playwright/test";

import { playerGames } from "../src/player-games.ts";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// A game listens for keys inside its own frame, and a frame only hears the keyboard while it has focus. The page does not move focus
// there (that would take the first Tab from its skip link). It passes the keys pressed while the page has the keyboard to a connected
// game, so a player presses Enter and plays with no click first.
const frameSelector = '[data-testid="game-frame"]';
const seenKeys = "seenKeys";

// Records every key the game's window hears, from now on.
const recordKeys = (frame: FrameLocator) =>
  frame.locator("body").evaluate((_body, name) => {
    const seen: string[] = [];
    Reflect.set(window, name, seen);
    window.addEventListener("keydown", (event) => seen.push(event.code));
  }, seenKeys);
const heard = (frame: FrameLocator) =>
  frame.locator("body").evaluate((_body, name) => {
    const value: unknown = Reflect.get(window, name);
    return Array.isArray(value) ? value.map(String) : [];
  }, seenKeys);

for (const id of await playerGames())
  test(`${id} hears Enter once it is connected, with no click`, async ({
    page,
  }) => {
    await page.goto(`/games/${id}`);
    await expectConnectedToPlatform(page);
    const frame = page.frameLocator(frameSelector);
    await recordKeys(frame);
    await page.keyboard.press("Enter");
    await expect.poll(() => heard(frame)).toEqual(["Enter"]);
  });

test("a key is heard once, whether or not the player has clicked into the game", async ({
  page,
}) => {
  await page.goto("/games/icicle-drop");
  await expectConnectedToPlatform(page);
  const frame = page.frameLocator(frameSelector);
  await recordKeys(frame);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => heard(frame)).toEqual(["ArrowLeft"]);
  await frame.locator("body").click({ position: { x: 5, y: 5 }, force: true });
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => heard(frame)).toEqual(["ArrowLeft", "ArrowRight"]);
});
