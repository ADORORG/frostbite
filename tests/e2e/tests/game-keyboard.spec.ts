import { expect, test, type FrameLocator } from "@playwright/test";

import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// A game listens for keys inside its own frame, and a frame only hears the keyboard while it has focus. The page does not move focus
// there (that would take the first Tab from its skip link). It passes the keys pressed while the page has the keyboard to a connected
// game, so a player presses Enter and plays with no click first.
const games = [
  "aurora-pulse",
  "bro-maria",
  "frostbite",
  "frost-runner",
  "icicle-drop",
  "lantern-maze",
  "shard-match",
  "snowball-dash",
  "tower-stack",
] as const;

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
  frame
    .locator("body")
    .evaluate((_body, name) => Reflect.get(window, name) as string[], seenKeys);

for (const id of games)
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

test("the first Tab is still the skip link, with the game connected", async ({
  page,
}) => {
  await page.goto("/games/icicle-drop");
  await expectConnectedToPlatform(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
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

test("Enter starts a run in Icicle Drop with no click first", async ({
  page,
}) => {
  await page.goto("/games/icicle-drop");
  await expectConnectedToPlatform(page);
  const start = page.frameLocator(frameSelector).locator("#start");
  await expect(start).toHaveText("Start run");
  await page.keyboard.press("Enter");
  await expect(start).toHaveText("New run");
});

test("Enter starts a run in Frost Runner with no click first", async ({
  page,
}) => {
  await page.goto("/games/frost-runner");
  await expectConnectedToPlatform(page);
  const frame = page.frameLocator(frameSelector);
  await page.keyboard.press("Enter");
  await expect(frame.locator("body")).toContainText(/Distance [1-9]\d* m/u, {
    timeout: 10_000,
  });
});
