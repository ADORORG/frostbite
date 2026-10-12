import { expect, test, type Page } from "@playwright/test";

// The game page built around the game: one title line, a slim bar that stays in view, the game as the main
// stage, small cards in a row below, a notice when a milestone is reported, and an offer of full screen to a
// phone held sideways. Desktop checks the layout; a touch device in landscape checks the offer.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const box = async (page: Page, selector: string) => {
  const found = await page.locator(selector).first().boundingBox();
  if (found === null) throw new Error(`${selector} has no box`);
  return found;
};

test("the page is a title line, a bar, the game as the main stage, then small cards in a row", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const title = await box(page, ".arcade-stage-title");
  const bar = await box(page, ".arcade-stage__bar");
  const stage = await box(page, frameSelector);
  const row = await box(page, ".arcade-info-row");
  expect(title.y).toBeLessThan(bar.y);
  expect(bar.y + bar.height).toBeLessThanOrEqual(stage.y + 2);
  expect(stage.y + stage.height).toBeLessThanOrEqual(row.y);
  // The title line is one line: small facts share it, and it is not a card.
  expect(title.height).toBeLessThan(80);
  await expect(page.locator(".arcade-stage-meta")).toContainText("v0.2.0");
  await expect(page.locator(".arcade-stage-meta")).toContainText("Playable");
  // The game takes the page's width and most of its height; the cards are small and side by side.
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("No viewport");
  expect(stage.width).toBeGreaterThan(Math.min(viewport.width, 1184) * 0.9);
  expect(stage.height).toBeGreaterThan(Math.min(viewport.height * 0.8, 480));
  const cards = page.locator(".arcade-info-card");
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole("region", { name: "About" })).toContainText(
    "Declarations digest:",
  );
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (first === null || second === null) throw new Error("No cards");
  if (viewport.width >= 900)
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
  await expect(page.locator(".arcade-panel")).toHaveCount(0);
});

test("the bar stays below the site header while the game is in view, on a large screen", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop" && testInfo.project.name !== "wide",
    "Large screens only.",
  );
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const bar = page.locator(".arcade-stage__bar");
  await expect(bar).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollBy(0, 400));
  await expect
    .poll(async () => (await bar.boundingBox())?.y ?? -1)
    .toBeGreaterThan(60);
  const header = await box(page, ".app-header");
  const top = (await bar.boundingBox())?.y ?? 0;
  expect(top).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(top).toBeLessThan(header.y + header.height + 12);
  await expect(
    page.getByRole("button", { name: "Full screen" }),
  ).toBeInViewport();
});

test("the bar does not stick on a small screen, where the header is tall", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Small screens only.");
  await page.goto("/games/frostbite");
  await expect(page.locator(".arcade-stage__bar")).toHaveCSS(
    "position",
    "static",
  );
});

test("a milestone the game reports is announced over the game, and the notice goes away", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const frame = page
    .frames()
    .find((candidate) =>
      candidate.url().endsWith("/play/frostbite/index.html"),
    );
  if (frame === undefined) throw new Error("No game frame");
  const notice = page.getByTestId("milestone-toast");
  await expect(notice).toHaveText("");
  await frame.evaluate(() => {
    (
      window as unknown as { FrostbiteHost: { milestone(m: string): void } }
    ).FrostbiteHost.milestone("firstWin");
  });
  await expect(notice).toHaveText("First win reached");
  await expect(notice).toHaveText("", { timeout: 9_000 });
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "1 of 3 reached",
  );
  // Seen again after a reload, it is not announced as new.
  await page.reload();
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "1 of 3 reached",
  );
  await expect(page.getByTestId("milestone-toast")).toHaveText("");
});

test.describe("a phone held sideways", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 360, width: 740 },
  });

  test("is offered full screen, and can decline", async ({ page }) => {
    await page.goto("/games/sample-game");
    await expect(page.getByText("Connected to the platform")).toBeVisible();
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, "This browser does not allow full screen.");
    const offer = page.getByTestId("fullscreen-prompt");
    await expect(offer).toContainText("Playing on a phone?");
    await offer.getByRole("button", { name: "Not now" }).click();
    await expect(offer).toHaveCount(0);
  });

  test("takes the game full screen from the offer", async ({ page }) => {
    await page.goto("/games/sample-game");
    await expect(page.getByText("Connected to the platform")).toBeVisible();
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, "This browser does not allow full screen.");
    await page
      .getByTestId("fullscreen-prompt")
      .getByRole("button", { name: "Full screen" })
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
  await page.goto("/games/sample-game");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await expect(page.getByTestId("fullscreen-prompt")).toHaveCount(0);
});
