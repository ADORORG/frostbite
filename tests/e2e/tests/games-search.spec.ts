import { expect, test, type Page } from "@playwright/test";

import { fixtureGame } from "./support/fixture-game.ts";
import { siteLink } from "./support/site-navigation.ts";

// Searching and filtering the games page in a real browser, on every viewport: what is typed narrows the wall at once, the address carries
// the query (so a reload and a shared link show the same games on the first paint), and the keys work. Games are named by what the platform
// lists (the fixture game is always there in a test run; the others are the games registered in configs/games).

const searchBox = (page: Page) =>
  page.getByRole("searchbox", { name: "Search games" });
const cardFor = (page: Page, title: string) =>
  page.getByRole("link", { name: `View ${title}` });
const found = (page: Page) =>
  page.getByRole("status").filter({ hasText: /found/u });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("typing narrows the games at once, says how many, and keeps the query in the address", async ({
  page,
}) => {
  await page.goto("/games");
  const all = await page.locator(".cover-card").count();
  expect(all).toBeGreaterThan(3);
  await searchBox(page).fill(fixtureGame.searchWord);
  await expect(cardFor(page, fixtureGame.title)).toBeVisible();
  await expect(page.locator(".cover-card")).toHaveCount(1);
  await expect(found(page)).toHaveText("1 game found");
  // The count is for a screen reader: it takes no room on the screen.
  const size = await found(page).boundingBox();
  expect(size?.width).toBeLessThanOrEqual(1);
  expect(size?.height).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(
    new RegExp(`/games\\?q=${fixtureGame.searchWord}$`, "u"),
  );
  await searchBox(page).fill("");
  await expect(page.locator(".cover-card")).toHaveCount(all);
  await expect(page).toHaveURL(/\/games$/u);
});

test("a slipped letter in a title still finds the game", async ({ page }) => {
  await page.goto("/games");
  await searchBox(page).fill(fixtureGame.title.replace("o", ""));
  await expect(cardFor(page, fixtureGame.title)).toBeVisible();
  await expect(page.locator(".cover-card")).toHaveCount(1);
});

test("a shared link opens already narrowed, before any script has run, and survives a reload", async ({
  browser,
  baseURL,
}) => {
  // A visitor with scripts off sees what the server drew from the address.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const bare = await context.newPage();
  await bare.goto(`${baseURL ?? ""}/games?q=${fixtureGame.searchWord}`);
  await expect(bare.locator(".cover-card")).toHaveCount(1);
  await context.close();

  const page = await browser.newPage();
  await page.goto(
    `${baseURL ?? ""}/games?q=${fixtureGame.searchWord}&playable=1`,
  );
  await expect(searchBox(page)).toHaveValue(fixtureGame.searchWord);
  await expect(page.locator(".cover-card")).toHaveCount(1);
  await page.reload();
  await expect(searchBox(page)).toHaveValue(fixtureGame.searchWord);
  await expect(page.locator(".cover-card")).toHaveCount(1);
  await page.close();
});

test("kinds of game filter the wall, and an empty answer says so and offers the way back", async ({
  page,
}) => {
  await page.goto("/games");
  const all = await page.locator(".cover-card").count();
  const kind = page.getByRole("button", {
    name: new RegExp(`^${fixtureGame.kind}`, "iu"),
  });
  await kind.click();
  await expect(kind).toHaveAttribute("aria-pressed", "true");
  await expect(cardFor(page, fixtureGame.title)).toBeVisible();
  // Other kinds of game are hidden: the games of other kinds drop off the wall.
  // The wall follows the query a moment after the button shows pressed (it renders a deferred copy), so the count is awaited.
  await expect
    .poll(() => page.locator(".cover-card").count())
    .toBeLessThan(all);
  await expect(page).toHaveURL(new RegExp(`kind=${fixtureGame.kind}`, "u"));

  await searchBox(page).fill("zzzzz");
  await expect(
    page.getByRole("heading", { name: "No games match" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Clear search and filters" })
    .last()
    .click();
  await expect(page.locator(".cover-card")).toHaveCount(all);
  await expect(page).toHaveURL(/\/games$/u);
});

test("the header's Games link, pressed while narrowed, shows every game again", async ({
  page,
}) => {
  await page.goto("/games");
  const all = await page.locator(".cover-card").count();
  await searchBox(page).fill(fixtureGame.searchWord);
  await expect(page.locator(".cover-card")).toHaveCount(1);
  await (await siteLink(page, "Games")).click();
  await expect(page).toHaveURL(/\/games$/u);
  await expect(page.locator(".cover-card")).toHaveCount(all);
  await expect(searchBox(page)).toHaveValue("");
});

test("/ jumps to the box and Escape empties it, then leaves it", async ({
  page,
}) => {
  await page.goto("/games");
  await page.keyboard.press("/");
  await expect(searchBox(page)).toBeFocused();
  await page.keyboard.type(fixtureGame.id.slice(0, 3));
  await expect(searchBox(page)).toHaveValue(fixtureGame.id.slice(0, 3));
  await page.keyboard.press("Escape");
  await expect(searchBox(page)).toHaveValue("");
  await expect(searchBox(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchBox(page)).not.toBeFocused();
});

// The stylesheet folds a group of filters into one row only on a narrow screen (40rem); a page-wide scroll check cannot see that, because
// an ancestor hides what overflows, so the row itself is measured.
const narrowScreenPx = 640;
test("on a narrow screen each group of kinds is one row that scrolls sideways", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) > narrowScreenPx,
    "The groups fold into one row only on a narrow screen.",
  );
  await page.goto("/games");
  const group = page.getByRole("group", { name: "Kinds of game" });
  expect(
    await group.evaluate((element) => getComputedStyle(element).overflowX),
  ).toBe("auto");
  const rows = await group
    .getByRole("button")
    .evaluateAll(
      (chips) =>
        new Set(
          chips.map((chip) => Math.round(chip.getBoundingClientRect().top)),
        ).size,
    );
  expect(rows).toBe(1);
  expect(
    await group.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
});

test("the controls never push the page wider than the screen, and a result opens its game", async ({
  page,
}) => {
  // Two kinds chosen at once (a game matches either), so the row of chosen filters is as wide as it gets.
  await page.goto(
    `/games?q=${fixtureGame.id.slice(0, 3)}&kind=${fixtureGame.kind}&kind=arcade&playable=1`,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await searchBox(page).fill(fixtureGame.searchWord);
  await cardFor(page, fixtureGame.title).click();
  await expect(page).toHaveURL(new RegExp(`${fixtureGame.href}$`, "u"));
});
