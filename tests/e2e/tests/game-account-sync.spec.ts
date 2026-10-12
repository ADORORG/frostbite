import { gameStateSchema } from "@ador/shared/games";
import { expect, test, type Browser } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { errorCode, post } from "../src/upload-api.ts";
import { signIn } from "../src/upload-helpers.ts";

// G3: a signed-in player's progress and milestones follow them to another browser, a signed-out player's
// stay in the one browser, and the sync route refuses what it should. The sample game, Tap Tower, is listed
// only when the platform runs for tests or development.
const frameSelector = '[data-testid="game-frame"]';
const syncPath = "/api/v1/games/sync";
const empty = { milestones: [], progress: null };

async function playerBrowser(
  browser: Browser,
  baseURL: string | undefined,
  actor: { readonly sessionToken: string },
) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await signIn(page, baseURL, actor);
  await page.goto("/games/sample-game");
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
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
  for (let tap = 0; tap < 5; tap += 1) await game.locator("#tap").click();
  await expect(game.locator("#score")).toHaveText("5");
  await expect(first.page.getByText("saved to your account")).toBeVisible();
  // The game saves a second after the last tap; the account has it once that sync lands.
  await expect
    .poll(
      async () =>
        gameStateSchema.parse(
          await (
            await first.page.request.post(syncPath, {
              data: { gameId: "sample-game", state: empty },
              headers: { origin: new URL(baseURL ?? "").origin },
            })
          ).json(),
        ).progress?.state,
    )
    .toEqual({ score: 5 });
  await first.context.close();

  // Another browser: no local storage at all, the same account.
  const second = await playerBrowser(
    browser,
    baseURL,
    creatorE2EFixtures.gamePlayer,
  );
  const again = second.page.frameLocator(frameSelector);
  await expect(again.locator("#score")).toHaveText("5");
  await expect(
    second.page.locator('[data-milestone="first-five"]'),
  ).toContainText("Reached");
  await expect(second.page.getByText("saved to your account")).toBeVisible();
  await second.context.close();

  // Another player sees none of it.
  const other = await playerBrowser(
    browser,
    baseURL,
    creatorE2EFixtures.otherGamePlayer,
  );
  await expect(
    other.page.frameLocator(frameSelector).locator("#score"),
  ).toHaveText("0");
  await expect(
    other.page.locator('[data-milestone="first-five"]'),
  ).toContainText("Not yet");
  await other.context.close();
});

test("a signed-out player's progress stays in that browser, and the page says so", async ({
  page,
}) => {
  await page.goto("/games/sample-game");
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText("Connected. Tap to score.");
  await game.locator("#tap").click();
  await expect(page.getByText("kept in this browser only")).toBeVisible();
  await expect(page.getByText("saved to your account")).toHaveCount(0);
});

test.describe("the sync route", () => {
  test("refuses a caller who is not signed in", async ({
    baseURL,
    request,
  }) => {
    const response = await post(request, baseURL, syncPath, {
      gameId: "sample-game",
      state: empty,
    });
    expect(response.status()).toBe(401);
    expect(await errorCode(response)).toBe("unauthorized");
  });

  test("refuses a request from another origin", async ({ baseURL, page }) => {
    await signIn(page, baseURL, creatorE2EFixtures.gamePlayer);
    const response = await page.request.post(syncPath, {
      data: { gameId: "sample-game", state: empty },
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
      id: "made-up",
      unlockedAt: "2026-10-01T00:00:00.000Z",
      verification: "self-reported",
    };
    const unknownMilestone = await send({
      gameId: "sample-game",
      state: { milestones: [made], progress: null },
    });
    expect(unknownMilestone.status()).toBe(400);
    const extra = await send({
      gameId: "sample-game",
      state: empty,
      userId: "x",
    });
    expect(extra.status()).toBe(400);
    const large = await send({
      gameId: "sample-game",
      state: {
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
      gameId: "sample-game",
      state: {
        milestones: [],
        progress: { savedAt: "2999-01-01T00:00:00.000Z", state: { score: 1 } },
      },
    };
    const first = gameStateSchema.parse(
      await (await post(page.request, baseURL, syncPath, forged)).json(),
    );
    const again = gameStateSchema.parse(
      await (await post(page.request, baseURL, syncPath, forged)).json(),
    );
    expect(again).toEqual(first);
    // Believed neither time: a wrong or forged clock cannot make a save outrank the real ones.
    expect(first.progress).toBeNull();
  });
});
