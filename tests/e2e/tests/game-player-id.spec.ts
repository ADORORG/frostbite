import { syncGameStateResponseSchema } from "@frostbite/shared/games";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";

// SDK-1b: the id a game is told the player is. Random and for one game alone; this browser's until the player
// signs in, then the account's, the same on every device. Read through the SDK explorer in the real frame.
const frameSelector = '[data-testid="game-frame"]';
const syncPath = "/api/v1/games/sync";
const empty = { counters: [], milestones: [], progress: null };

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function identityOf(page: Page): Promise<{ id: string; kind: string }> {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  await game.locator("#identity").click();
  const line = game.locator("#log li").first();
  await expect(line).toContainText("player.identity → ");
  const text = (await line.textContent()) ?? "";
  return JSON.parse(text.replace("player.identity → ", "")) as {
    id: string;
    kind: string;
  };
}

async function playerPage(
  browser: Browser,
  baseURL: string | undefined,
  actor: { readonly sessionToken: string },
) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page, baseURL, actor);
  await page.goto("/games/sdk-explorer");
  return { context, page };
}

test("a signed-out player is given an id that stays the same in that browser", async ({
  page,
}) => {
  await page.goto("/games/sdk-explorer");
  const first = await identityOf(page);
  expect(first.kind).toBe("local");
  expect(first.id).toMatch(/^[0-9a-f-]{36}$/u);
  await page.reload();
  expect(await identityOf(page)).toEqual(first);
  // Kept by the platform page under a key for this game, never by the game.
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("frostbite:game:sdk-explorer:player-id"),
    ),
  ).toBe(JSON.stringify(first.id));
});

test("a signed-in player is given the account's id, the same in every browser, and another player's differs", async ({
  baseURL,
  browser,
}) => {
  const first = await playerPage(
    browser,
    baseURL,
    creatorE2EFixtures.gamePlayer,
  );
  const mine = await identityOf(first.page);
  expect(mine.kind).toBe("account");
  // What the server holds for this player and game is exactly what the game was told.
  const served = syncGameStateResponseSchema.parse(
    await (
      await first.page.request.post(syncPath, {
        data: { gameId: "sdk-explorer", state: empty },
        headers: { origin: new URL(baseURL ?? "").origin },
      })
    ).json(),
  );
  expect(mine.id).toBe(served.playerId);
  // The player's id in another game is a different one.
  const otherGame = syncGameStateResponseSchema.parse(
    await (
      await first.page.request.post(syncPath, {
        data: { gameId: "frost-runner", state: empty },
        headers: { origin: new URL(baseURL ?? "").origin },
      })
    ).json(),
  );
  expect(otherGame.playerId).not.toBe(mine.id);
  await first.context.close();

  const second = await playerPage(
    browser,
    baseURL,
    creatorE2EFixtures.gamePlayer,
  );
  expect(await identityOf(second.page)).toEqual(mine);
  await second.context.close();

  const other = await playerPage(
    browser,
    baseURL,
    creatorE2EFixtures.otherGamePlayer,
  );
  const theirs = await identityOf(other.page);
  expect(theirs.kind).toBe("account");
  expect(theirs.id).not.toBe(mine.id);
  await other.context.close();
});
