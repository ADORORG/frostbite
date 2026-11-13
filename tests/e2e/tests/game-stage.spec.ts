import { expect, test, type Page } from "@playwright/test";

import { openDock } from "./support/dock.ts";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";
import { fixtureGame } from "./support/fixture-game.ts";

// The game page built as a game screen: the game on nearly the whole screen under a slim bar that holds its
// title, a dock of sections at the foot that opens over the game, a notice when a milestone is reported, and an
// offer of full screen to a phone held sideways. Desktop checks the layout; a touch device in landscape checks
// the offer.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// Where an element is on the page, not on the screen: opening the dock may scroll the page, which moves nothing in it.
const placeOnPage = async (page: Page, selector: string) => {
  const found = await box(page, selector);
  const scrolled = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  return { ...found, x: found.x + scrolled.x, y: found.y + scrolled.y };
};

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).first().boundingBox();
  if (found === null) throw new Error(`${selector} has no box`);
  return found;
};

test("the page is the game on nearly the whole screen, with its title in the bar and a dock at the foot", async ({
  page,
}) => {
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  const bar = await box(page, ".arcade-stage__bar");
  const stage = await box(page, frameSelector);
  const dock = await box(page, ".arcade-dock__strip");
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("No viewport");
  // The title and the small facts are in the bar over the game, not a block of their own.
  await expect(page.locator(".arcade-stage__bar h2")).toHaveText(
    fixtureGame.title,
  );
  await expect(page.locator(".arcade-stage__facts")).toContainText(
    `v${fixtureGame.version}`,
  );
  await expect(page.locator(".arcade-stage-head")).toHaveCount(0);
  expect(bar.y + bar.height).toBeLessThanOrEqual(stage.y + 2);
  // Where the page is taller than the screen the dock is pulled up over the game's foot to stay in view; where
  // it is not, the game ends where the dock begins.
  if (stage.y + stage.height <= viewport.height)
    expect(stage.y + stage.height).toBeLessThanOrEqual(dock.y + 2);
  // The game takes the page's width, and is tall enough to be a screen.
  expect(stage.width).toBeGreaterThan(viewport.width * 0.9);
  expect(stage.height).toBeGreaterThan(Math.min(viewport.height * 0.55, 480));
  // The dock is in view without scrolling, and nothing of the page's own is a card under the game.
  expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.locator(".arcade-info-row")).toHaveCount(0);
  await expect(page.locator(".arcade-panel")).toHaveCount(0);
});

// The header wraps its buttons onto a second row on a narrow phone, so it is taller there than its token, and a stage sized from the token
// ran under the dock. The stage must end where the dock begins at every phone width, with the page at its top.
for (const [width, height] of [
  [320, 568],
  [360, 640],
  [375, 667],
] as const) {
  test(`the stage ends where the dock begins on a ${String(width)}px phone, whatever height the header has`, async ({
    page,
  }) => {
    await page.setViewportSize({ height, width });
    await page.goto(fixtureGame.href);
    await expectConnectedToPlatform(page);
    await expect
      .poll(async () => {
        const stage = await box(page, ".arcade-section--stage > .arcade-stage");
        const dock = await box(page, ".arcade-dock__strip");
        return stage.y + stage.height - dock.y;
      })
      .toBeLessThanOrEqual(1);
  });
}

test("the dock is closed until asked, opens one section over the game without moving it, and goes back", async ({
  page,
}) => {
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  const before = await placeOnPage(page, frameSelector);
  await expect(page.getByRole("region", { name: "About" })).toBeHidden();
  const about = await openDock(page, "About");
  await expect(about).toContainText("Declarations digest:");
  await expect(
    page.getByRole("region", { name: "Your milestones" }),
  ).toBeHidden();
  // It is drawn over the game, so the game is where it was.
  expect(await placeOnPage(page, frameSelector)).toEqual(before);
  const panel = await box(page, ".arcade-dock__panel:not([hidden])");
  const strip = await box(page, ".arcade-dock__strip");
  expect(panel.y + panel.height).toBeLessThanOrEqual(strip.y + 1);
  await page.getByRole("button", { name: "What it asks for" }).click();
  await expect(
    page.getByRole("region", { name: "What it asks for" }),
  ).toContainText("This game does not ask the platform for anything.");
  await expect(about).toBeHidden();
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.locator(".arcade-dock__panel:not([hidden])")).toHaveCount(
    0,
  );
});

test("Escape closes the dock and keeps the focus on its button", async ({
  page,
}) => {
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  await openDock(page, "About");
  await page.keyboard.press("Escape");
  await expect(page.locator(".arcade-dock__panel:not([hidden])")).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "About" })).toBeFocused();
});

test("clicking into the game closes the dock", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One check is enough.");
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  await openDock(page, "Milestones");
  await page.locator(frameSelector).click({ position: { x: 40, y: 40 } });
  await expect(page.locator(".arcade-dock__panel:not([hidden])")).toHaveCount(
    0,
  );
});

test.describe("a short screen", () => {
  test.use({ viewport: { height: 560, width: 1100 } });

  test("fits the whole stage, dock included, on the screen", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One check is enough.");
    await page.goto(fixtureGame.href);
    await expectConnectedToPlatform(page);
    const stage = await box(page, ".arcade-stage");
    expect(stage.y + stage.height).toBeLessThanOrEqual(560);
    const dock = await box(page, ".arcade-dock__strip");
    expect(Math.round(dock.y + dock.height)).toBe(560);
  });
});

test("has a way back to the list in the bar", async ({ page }) => {
  await page.goto(fixtureGame.href);
  await page
    .locator(".arcade-stage__bar")
    .getByRole("link", { name: "All games" })
    .click();
  await expect(page).toHaveURL(/\/games$/u);
});

test("the bar sits directly under the site header on a large screen, with Full screen in view", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "wide",
    "Large screens only.",
  );
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  const bar = await box(page, ".arcade-stage__bar");
  const header = await box(page, ".app-header");
  expect(bar.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(bar.y).toBeLessThan(header.y + header.height + 12);
  await expect(
    page.getByRole("button", { name: "Full screen" }),
  ).toBeInViewport();
});

test("the bar does not stick on a small screen, where the header is tall", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Small screens only.");
  await page.goto(fixtureGame.href);
  await expect(page.locator(".arcade-stage__bar")).toHaveCSS(
    "position",
    "static",
  );
});

test("a milestone the game reports is announced over the game, and the notice goes away", async ({
  page,
}) => {
  await page.goto(fixtureGame.href);
  await expectConnectedToPlatform(page);
  const notice = page.getByTestId("milestone-toast");
  await expect(notice).toHaveText("");
  for (let tap = 0; tap < fixtureGame.tapsForFirstMilestone; tap += 1)
    await page.frameLocator(frameSelector).locator("#tap").click();
  await expect(notice).toHaveText(
    `${fixtureGame.firstMilestone.title} reached`,
  );
  await expect(notice).toHaveText("", { timeout: 9_000 });
  await expect(
    page.getByRole("button", { name: /^Milestones/u }),
  ).toContainText(`1/${String(fixtureGame.milestones.length)}`);
  await openDock(page, "Milestones");
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    `1 of ${String(fixtureGame.milestones.length)} reached`,
  );
  // Seen again after a reload, it is not announced as new.
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Milestones/u }),
  ).toContainText(`1/${String(fixtureGame.milestones.length)}`);
  await expect(page.getByTestId("milestone-toast")).toHaveText("");
});

test.describe("a phone held sideways", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 360, width: 740 },
  });

  test("is offered full screen, and can decline", async ({ page }) => {
    await page.goto("/games/sdk-explorer");
    await expectConnectedToPlatform(page);
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, "This browser does not allow full screen.");
    const offer = page.getByTestId("fullscreen-prompt");
    await expect(offer).toContainText("Playing on a phone?");
    await offer.getByRole("button", { name: "Not now" }).click();
    await expect(offer).toHaveCount(0);
  });

  test("takes the game full screen from the offer", async ({ page }) => {
    await page.goto("/games/sdk-explorer");
    await expectConnectedToPlatform(page);
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, "This browser does not allow full screen.");
    await page
      .getByTestId("fullscreen-prompt")
      .getByRole("button", { name: "Play full screen" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.fullscreenElement?.getAttribute("data-testid") ?? null,
        ),
      )
      .toBe("game-frame");
  });
});

test("a computer is not offered the phone prompt", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One check is enough.");
  await page.goto("/games/sdk-explorer");
  await expectConnectedToPlatform(page);
  await expect(page.getByTestId("fullscreen-prompt")).toHaveCount(0);
});
