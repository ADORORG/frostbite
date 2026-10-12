import { expect, test } from "@playwright/test";

import { closeMatrix, skipToMain } from "./support/quality.ts";

// Layout, keyboard, reduced-motion, accessibility and visual coverage of the public games pages on every
// viewport project. The platform lists FROST·BITE, which it plays itself in the isolated frame, so the pages
// are checked with a game that can be played (the picture of the page leaves the frame's inside out: the
// game's own animation is not the platform's to baseline).

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the games list closes the experience-quality matrix", async ({
  page,
}) => {
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { level: 2, name: "Games" }),
  ).toBeVisible();
  const card = page.getByRole("article", { name: "FROST·BITE" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Playable")).toBeVisible();
  await skipToMain(page);
  await page.getByRole("link", { name: "View FROST·BITE" }).focus();
  await expect(
    page.getByRole("link", { name: "View FROST·BITE" }),
  ).toBeFocused();
  await closeMatrix(page, "games-list.png");
});

test("a game's page closes the experience-quality matrix", async ({ page }) => {
  await page.goto("/games");
  await page.getByRole("link", { name: "View FROST·BITE" }).click();
  await expect(page).toHaveURL(/\/games\/frostbite$/u);
  await expect(
    page.getByRole("heading", { level: 2, name: "FROST·BITE" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("This game is played on this page."),
  ).toBeVisible();
  // It is played here, not at another address, and nothing is declared that the platform cannot honour.
  await expect(page.getByRole("link", { name: /^Play/u })).toHaveCount(0);
  await expect(
    page.getByText("does not ask the platform for anything"),
  ).toBeVisible();
  // The digest changes whenever the manifest does, which is its job; the baseline is of the layout.
  await page
    .getByText(/^Declarations digest:/u)
    .evaluate(
      (node) => (node.textContent = "Declarations digest: 0000000000000000"),
    );
  // The baseline is the platform's layout around the game; the game inside the frame animates and is checked on
  // its own (frostbite.spec.ts), so the frame is left blank here.
  await page.addStyleTag({
    content: '[data-testid="game-frame"]{visibility:hidden}',
  });
  await skipToMain(page);
  await closeMatrix(page, "game-detail.png");
});

test("a game that is not registered closes the experience-quality matrix", async ({
  page,
}) => {
  await page.goto("/games/no-such-game");
  await expect(page.getByText("Record not published")).toBeVisible();
  await closeMatrix(page, "game-not-published.png");
});

test("an address that cannot be a game says so", async ({ page }) => {
  await page.goto("/games/Not-A-Game");
  await expect(page.getByText("Invalid identifier")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse games" })).toBeVisible();
});
