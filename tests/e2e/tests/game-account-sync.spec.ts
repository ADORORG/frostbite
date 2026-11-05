import { syncGameStateResponseSchema } from "@ador/shared/games";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { errorCode, post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";

// G3: a signed-in player's progress and milestones follow them to another browser, a signed-out player's
// stay in the one browser, and the sync route refuses what it should. Played through the SDK explorer, which is listed
// only when the platform runs for tests or development.
const frameSelector = '[data-testid="game-frame"]';
const syncPath = "/api/v1/games/sync";
const empty = { counters: [], milestones: [], progress: null };
const connected = "Connected. Call anything below.";
type Frame = ReturnType<Page["frameLocator"]>;

// Saves the explorer's counter `times` times, waiting for each answer so the next save counts on the last.
async function saveProgress(game: Frame, times: number) {
  for (let call = 1; call <= times; call += 1) {
    await game.locator("#progress-save").click();
    await expect(game.locator("#log li").first()).toHaveText(
      `progress.save → {"saved":{"calls":${String(call)}}}`,
    );
  }
}

async function playerBrowser(
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

test("progress and milestones follow a signed-in player to another browser", async ({
  baseURL,
  browser,
}, testInfo) => {
  // One account for the whole run: the viewport projects would each add to what the last one saved.
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop only, with its own accounts.",
  );
  const first = await playerBrowser(
    browser,
    baseURL,
    creatorE2EFixtures.gamePlayer,
  );
  const game = first.page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(connected);
  await saveProgress(game, 5);
  await game.locator("#milestones-unlock").click();
  await expect(first.page.getByText("saved to your account")).toBeVisible();
  // The account has the save once the platform's sync lands.
  await expect
    .poll(
      async () =>
        syncGameStateResponseSchema.parse(
          await (
            await first.page.request.post(syncPath, {
              data: { gameId: "sdk-explorer", state: empty },
              headers: { origin: new URL(baseURL ?? "").origin },
            })
          ).json(),
        ).progress?.state,
    )
    .toEqual({ calls: 5 });
  await first.context.close();

  // Another browser: no local storage at all, the same account.
  const second = await playerBrowser(
    browser,
    baseURL,
    creatorE2EFixtures.gamePlayer,
  );
  const again = second.page.frameLocator(frameSelector);
  await expect(again.locator("#status")).toHaveText(connected);
  await again.locator("#progress-load").click();
  await expect(again.locator("#log li").first()).toHaveText(
    'progress.load → {"state":{"calls":5}}',
  );
  await expect(
    second.page.locator('[data-milestone="first-call"]'),
  ).toContainText("Reached");
  await expect(second.page.getByText("saved to your account")).toBeVisible();
  await second.context.close();

  // Another player sees none of it.
  const other = await playerBrowser(
    browser,
    baseURL,
    creatorE2EFixtures.otherGamePlayer,
  );
  const theirs = other.page.frameLocator(frameSelector);
  await expect(theirs.locator("#status")).toHaveText(connected);
  await theirs.locator("#progress-load").click();
  await expect(theirs.locator("#log li").first()).toHaveText(
    'progress.load → {"state":null}',
  );
  await expect(
    other.page.locator('[data-milestone="first-call"]'),
  ).toContainText("Not yet");
  await other.context.close();
});

test("a signed-out player's progress stays in that browser, and the page says so", async ({
  page,
}) => {
  await page.goto("/games/sdk-explorer");
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(connected);
  await saveProgress(game, 1);
  // The bar hides this line on a narrow screen and keeps it in the title, so its text is read, not looked for on the screen.
  await expect(page.locator(".arcade-stage__save")).toContainText(
    "kept in this browser only",
  );
  await expect(page.getByText("saved to your account")).toHaveCount(0);
});

test.describe("the sync route", () => {
  test("refuses a caller who is not signed in", async ({
    baseURL,
    request,
  }) => {
    const response = await post(request, baseURL, syncPath, {
      gameId: "sdk-explorer",
      state: empty,
    });
    expect(response.status()).toBe(401);
    expect(await errorCode(response)).toBe("unauthorized");
  });

  test("refuses a request from another origin", async ({ baseURL, page }) => {
    await signIn(page, baseURL, creatorE2EFixtures.gamePlayer);
    const response = await page.request.post(syncPath, {
      data: { gameId: "sdk-explorer", state: empty },
      headers: { origin: "https://evil.example" },
    });
    expect(response.status()).toBe(403);
  });

  test("refuses a game that is not listed, a milestone it never declared, a field it does not have, and an oversized save", async ({
    baseURL,
    page,
  }) => {
    await signIn(page, baseURL, creatorE2EFixtures.gamePlayer);
    const send = (body: object) => post(page.request, baseURL, syncPath, body);
    const unknownGame = await send({ gameId: "no-such-game", state: empty });
    expect(unknownGame.status()).toBe(404);
    const made = {
      count: 1,
      id: "made-up",
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "self-reported",
    };
    const unknownMilestone = await send({
      gameId: "sdk-explorer",
      state: { counters: [], milestones: [made], progress: null },
    });
    expect(unknownMilestone.status()).toBe(400);
    const extra = await send({
      gameId: "sdk-explorer",
      state: empty,
      userId: "x",
    });
    expect(extra.status()).toBe(400);
    const large = await send({
      gameId: "sdk-explorer",
      state: {
        counters: [],
        milestones: [],
        progress: {
          savedAt: "2026-10-01T00:00:00.000Z",
          state: "x".repeat(70_000),
        },
      },
    });
    expect(large.status()).toBe(400);
  });

  test("answers a repeated request with the same state, and ignores a save dated in the far future", async ({
    baseURL,
    page,
  }) => {
    await signIn(page, baseURL, creatorE2EFixtures.otherGamePlayer);
    const forged = {
      gameId: "sdk-explorer",
      state: {
        counters: [],
        milestones: [],
        progress: { savedAt: "2999-01-01T00:00:00.000Z", state: { calls: 1 } },
      },
    };
    const first = syncGameStateResponseSchema.parse(
      await (await post(page.request, baseURL, syncPath, forged)).json(),
    );
    const again = syncGameStateResponseSchema.parse(
      await (await post(page.request, baseURL, syncPath, forged)).json(),
    );
    expect(again).toEqual(first);
    // The player's id for the game is the same each time, and is an id, not the account.
    expect(first.playerId).toMatch(/^[0-9a-f-]{36}$/u);
    // Believed neither time: a wrong or forged clock cannot make a save outrank the real ones.
    expect(first.progress).toBeNull();
  });
});
