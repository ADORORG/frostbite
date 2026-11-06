import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleGameScript } from "@frostbite/game-sdk/build";
import { expect, test, type Page } from "@playwright/test";

// The few action buttons a game draws over its screen on a phone (the SDK's touch-buttons and phone.css): in a corner, a thumb wide, inside
// the screen, the page not scrolling, the screen still the whole frame, and each finger its own.
const sdk = join(import.meta.dirname, "../../../packages/game-sdk/src");
const origin = "http://fixture.test";
const minimum = 44;

async function open(page: Page): Promise<void> {
  const script = await bundleGameScript(
    join(import.meta.dirname, "support/touch-buttons-fixture.ts"),
  );
  const files: Record<string, { body: string; type: string }> = {
    "/": {
      body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/phone.css"><style>body{margin:0}main>canvas{inline-size:100%;block-size:100%}</style><main><canvas width="256" height="144"></canvas><div class="actions"><button id="pause" type="button">Pause</button></div></main><script src="/main.js"></script>`,
      type: "text/html",
    },
    "/main.js": { body: script, type: "text/javascript" },
    "/phone.css": {
      body: await readFile(join(sdk, "phone.css"), "utf8"),
      type: "text/css",
    },
    "/phone-frame.css": {
      body: await readFile(join(sdk, "phone-frame.css"), "utf8"),
      type: "text/css",
    },
  };
  await page.route(`${origin}/**`, (route) => {
    const file = files[new URL(route.request().url()).pathname];
    if (file === undefined) return route.fulfill({ status: 404 });
    return route.fulfill({ body: file.body, contentType: file.type });
  });
  await page.goto(`${origin}/`);
}
const logOf = (page: Page) =>
  page.evaluate((): string[] => {
    const value: unknown = Reflect.get(window, "log");
    return Array.isArray(value) ? value.map(String) : [];
  });

test.describe("on a touch screen", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "a touch profile only");
  });

  test("the buttons are a thumb wide, inside the screen, and the screen is still the whole frame with the page not scrolling", async ({
    page,
  }) => {
    await open(page);
    const view = page.viewportSize();
    const buttons = page.locator(".touch-buttons button");
    await expect(buttons).toHaveCount(3);
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(minimum);
      expect(box?.height).toBeGreaterThanOrEqual(minimum);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        view?.width ?? 0,
      );
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        view?.height ?? 0,
      );
    }
    const screen = await page.locator("canvas").boundingBox();
    expect(screen?.width).toBeCloseTo(view?.width ?? 0, 0);
    expect(screen?.height).toBeCloseTo(view?.height ?? 0, 0);
    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(scrolls).toBe(false);
  });

  test("two thumbs hold two buttons at once, and a finger on the screen is a finger on the screen, not on a button", async ({
    page,
  }) => {
    await open(page);
    const fire = await page.getByRole("button", { name: "Fire" }).boundingBox();
    const next = await page.getByRole("button", { name: "Next" }).boundingBox();
    const centre = (box: typeof fire) => ({
      x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
    });
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [
        { ...centre(fire), id: 1 },
        { ...centre(next), id: 2 },
      ],
      type: "touchStart",
    });
    await expect.poll(() => logOf(page)).toEqual(["press Fire", "press Next"]);
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ ...centre(next), id: 2 }],
      type: "touchEnd",
    });
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ ...centre(fire), id: 1 }],
      type: "touchEnd",
    });
    await expect
      .poll(() => logOf(page))
      .toEqual(["press Fire", "press Next", "release Next", "release Fire"]);
    await page.touchscreen.tap(30, 300);
    await expect.poll(() => logOf(page)).toContain("screen");
    expect(await logOf(page)).not.toContain("press Help");
  });
});

test("a mouse is not shown the buttons: it has the keys", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "a mouse profile only");
  await open(page);
  await expect(page.locator(".touch-buttons")).toBeHidden();
});
