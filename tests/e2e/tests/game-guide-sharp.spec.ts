import { expect, test, type FrameLocator } from "@playwright/test";

import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// A game draws on a small canvas that the page scales up, which blurs any writing on it. The first-screen card is therefore a second
// canvas laid over the first at the pixels of the display (the SDK's guide layer): as many pixels as its size on the page times the
// display's pixel ratio. Checked at twice the usual density, where a card made on the small canvas is visibly soft.
const games = [
  "aurora-pulse",
  "bro-maria",
  "frost-runner",
  "lantern-maze",
  "shard-match",
  "snowball-dash",
  "tower-stack",
] as const;
const ratio = 2;
const frameSelector = '[data-testid="game-frame"]';

interface Layer {
  readonly cssWidth: number;
  readonly pixels: number;
  readonly shown: boolean;
}

// The card's own canvas: the one the SDK lays over the screen, fixed in place and not taking touches.
const layerOf = (frame: FrameLocator) =>
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

test.use({ deviceScaleFactor: ratio });

for (const id of games)
  test(`${id}'s first-screen card has the display's pixels, and goes when a run starts`, async ({
    page,
  }) => {
    await page.goto(`/games/${id}`);
    await expectConnectedToPlatform(page);
    const frame = page.frameLocator(frameSelector);
    await expect.poll(() => layerOf(frame)).toMatchObject({ shown: true });
    const layer = await layerOf(frame);
    expect(layer?.cssWidth).toBeGreaterThan(100);
    expect(layer?.pixels).toBeGreaterThanOrEqual(
      Math.round((layer?.cssWidth ?? 0) * ratio) - 1,
    );
    await page.keyboard.press("Enter");
    await expect.poll(() => layerOf(frame)).toMatchObject({ shown: false });
  });

// The card after a run is the same layer: Snowball Dash, left to roll with no input, hits a rock, and its result card then has the display's pixels.
test("snowball-dash's card after a run has the display's pixels", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/games/snowball-dash");
  await expectConnectedToPlatform(page);
  const frame = page.frameLocator(frameSelector);
  await expect.poll(() => layerOf(frame)).toMatchObject({ shown: true });
  await page.keyboard.press("Enter");
  await expect.poll(() => layerOf(frame)).toMatchObject({ shown: false });
  await expect
    .poll(() => layerOf(frame), { timeout: 60_000 })
    .toMatchObject({ shown: true });
  const layer = await layerOf(frame);
  expect(layer?.pixels).toBeGreaterThanOrEqual(
    Math.round((layer?.cssWidth ?? 0) * ratio) - 1,
  );
});
