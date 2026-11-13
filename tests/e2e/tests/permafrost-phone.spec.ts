import { restartDelayMs } from "@frostbite/game-sdk/touch-start";
import { expect, test } from "@playwright/test";

import {
  holdLeft,
  nextLeft,
  panelGap,
  panelHeight,
  panelTop,
  panelWidth,
  screenHeight,
  screenWidth,
} from "@game/permafrost/screen/layout";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// Permafrost on a phone: while a run goes, nothing the platform or the game lays over the screen may cover the board (where the pieces are), the
// piece held or the pieces to come. The readouts and four buttons sit in the side columns instead (`games/permafrost/touch-layout.css`), and
// where those columns are depends on the frame, so it is checked in several: held upright, small and large, and on its side.
interface Rect {
  readonly b: number;
  readonly l: number;
  readonly r: number;
  readonly t: number;
}

const frames = [
  { height: 568, name: "320x568", width: 320 },
  { height: 618, name: "375x618", width: 375 },
  { height: 640, name: "360x640", width: 360 },
  { height: 844, name: "390x844", width: 390 },
  { height: 915, name: "412x915", width: 412 },
  { height: 375, name: "667x375 on its side", width: 667 },
  { height: 360, name: "750x360 on its side", width: 750 },
] as const;

test.use({ deviceScaleFactor: 2, hasTouch: true, isMobile: true });
test.beforeEach(({ page }, info) => {
  test.skip(
    info.project.name !== "mobile",
    "Checked once, in its own phone frames.",
  );
  return page.emulateMedia({ reducedMotion: "reduce" });
});

const overlap = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) *
  Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

for (const size of frames)
  test(`while a run goes, nothing covers the board in ${size.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/games/permafrost");
    await expectConnectedToPlatform(page);
    await page.waitForTimeout(restartDelayMs + 200);
    // On its side the platform offers full screen over the game; a player who wants it where it is says "not now".
    const notNow = page.getByRole("button", { name: /not now/i });
    if ((await notNow.count()) > 0) await notNow.click();
    // On its side the window is short and the frame may lie partly below it: bring it in, and tap inside the part that shows.
    await page.locator('[data-testid="game-frame"]').scrollIntoViewIfNeeded();
    const frameBox = await page
      .locator('[data-testid="game-frame"]')
      .boundingBox();
    expect(frameBox).not.toBeNull();
    if (frameBox === null) return;
    const shownTop = Math.max(frameBox.y, 0);
    const shownBottom = Math.min(frameBox.y + frameBox.height, size.height);
    await page.touchscreen.tap(
      frameBox.x + frameBox.width / 2,
      (shownTop + shownBottom) / 2,
    );
    const frame = page.frameLocator('[data-testid="game-frame"]');
    await expect(frame.locator("#pause")).toBeEnabled();
    await page.waitForTimeout(600);
    const found = await frame.locator("body").evaluate(() => {
      const rect = (el: Element): Rect => {
        const r = el.getBoundingClientRect();
        return { b: r.bottom, l: r.left, r: r.right, t: r.top };
      };
      const canvas = document.querySelector("canvas#screen");
      return {
        buttons: [...document.querySelectorAll(".touch-buttons button")].map(
          (b) => ({
            name: b.textContent ?? "",
            rect: rect(b),
            visible: getComputedStyle(b).visibility,
          }),
        ),
        canvas: canvas === null ? null : rect(canvas),
        height: innerHeight,
        icons: [
          ...document.querySelectorAll(".actions button, #sound button"),
        ].map(rect),
        pills: [...document.querySelectorAll(".score span")].map(rect),
        width: innerWidth,
      };
    });
    expect(found.canvas).not.toBeNull();
    if (found.canvas === null) return;
    // Where the picture is drawn in the canvas (the whole of it, as large as fits, in the middle), and so where each part of it lies.
    const c = found.canvas;
    const scale = Math.min(
      (c.r - c.l) / screenWidth,
      (c.b - c.t) / screenHeight,
    );
    const left = c.l + (c.r - c.l - screenWidth * scale) / 2;
    const top = c.t + (c.b - c.t - screenHeight * scale) / 2;
    const part = (x: number, y: number, w: number, h: number): Rect => ({
      b: top + (y + h) * scale,
      l: left + x * scale,
      r: left + (x + w) * scale,
      t: top + y * scale,
    });
    const covered: Record<string, Rect> = {
      board: part(32, panelTop, 80, 160),
      hold: part(holdLeft, panelTop, panelWidth, panelHeight),
    };
    for (let at = 0; at < 3; at += 1)
      covered[`next ${String(at + 1)}`] = part(
        nextLeft,
        panelTop + at * (panelHeight + panelGap),
        panelWidth,
        panelHeight,
      );
    const over = [
      ...found.buttons.map((b) => ({ name: b.name, rect: b.rect })),
      ...found.pills.map((rect, at) => ({
        name: `readout ${String(at + 1)}`,
        rect,
      })),
      ...found.icons.map((rect, at) => ({
        name: `icon ${String(at + 1)}`,
        rect,
      })),
    ].flatMap(({ name, rect }) =>
      Object.entries(covered).flatMap(([what, area]) =>
        overlap(rect, area) > 0
          ? [
              `${name} covers ${what} by ${String(Math.round(overlap(rect, area)))}px²`,
            ]
          : [],
      ),
    );
    expect(over).toEqual([]);
    // The four buttons are in sight, a thumb wide, inside the frame, and none on another.
    expect(found.buttons.map((b) => b.name).sort()).toEqual([
      "Drop",
      "Hold",
      "Soft",
      "Turn",
    ]);
    for (const b of found.buttons) {
      expect(b.visible).toBe("visible");
      expect(b.rect.r - b.rect.l).toBeGreaterThanOrEqual(44);
      expect(b.rect.l).toBeGreaterThanOrEqual(0);
      expect(b.rect.r).toBeLessThanOrEqual(found.width);
      expect(b.rect.t).toBeGreaterThanOrEqual(0);
      expect(b.rect.b).toBeLessThanOrEqual(found.height);
    }
    for (let x = 0; x < 4; x += 1)
      for (let y = x + 1; y < 4; y += 1)
        expect(
          overlap(found.buttons[x]?.rect ?? c, found.buttons[y]?.rect ?? c),
        ).toBe(0);
  });
