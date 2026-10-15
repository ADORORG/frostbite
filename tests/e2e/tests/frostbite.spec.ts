import { expect, test, type Page } from "@playwright/test";

import { openDock } from "./support/dock.ts";

// FROST·BITE, the first real game, played on the platform in the isolated frame: it boots from one bundle with
// nothing from the network, gets a storage the platform keeps, and is cut off like every game. Desktop only: the
// game's interior is animated, so these steps drive and assert it rather than comparing pictures of it.
const frameSelector = '[data-testid="game-frame"]';
const progressKey = "ador:game:frostbite:progress";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`error: ${error.message}`));
  page.on("requestfailed", (request) =>
    problems.push(`failed: ${request.url()}`),
  );
  return problems;
}

async function enterArcade(page: Page) {
  const game = page.frameLocator(frameSelector);
  await expect(game.getByText("press SPACE to skip")).toBeVisible();
  // The skip button pulses and sits below the frame's own viewport, so the click is sent to it directly.
  await game.getByRole("button", { name: /SKIP/u }).dispatchEvent("click");
  await expect(game.getByText("SELECT YOUR OPERATOR")).toBeVisible();
  await game
    .getByRole("button", { name: /ENTER THE ARCADE/u })
    .dispatchEvent("click");
  return game;
}

function gameFrame(page: Page) {
  const frame = page
    .frames()
    .find((candidate) =>
      candidate.url().endsWith("/play/frostbite/index.html"),
    );
  if (frame === undefined) throw new Error("The game's frame is missing.");
  return frame;
}

test("the game boots from its one bundle, connects to the platform and can be entered, with no error and nothing fetched from outside", async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  const game = await enterArcade(page);
  // The game's own onboarding is a simulation and says so on its first step.
  await expect(game.getByTestId("simulation-notice")).toContainText(
    "DEMO MODE",
  );
  await expect(game.getByText("connect a wallet")).toBeVisible();
  expect(problems).toEqual([]);
  // Everything the frame loaded came from the platform's own address.
  const origin = new URL(page.url()).origin;
  const requests = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/play/frostbite/")),
  );
  expect(requests.length).toBeGreaterThan(0);
  for (const name of requests) expect(name.startsWith(origin)).toBe(true);
});

test("what the game keeps goes through the platform, and is back after a reload", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await enterArcade(page);
  // The game asks for its `localStorage`, which the frame does not have; it is given the platform's.
  const set = await gameFrame(page).evaluate(() => {
    localStorage.setItem("frostbite.levels.v1", '{"sats":3}');
    localStorage.setItem("not-kept", "this visit only");
    return localStorage.getItem("frostbite.levels.v1");
  });
  expect(set).toBe('{"sats":3}');
  // Saved through the platform about a second later, and only the key the game keeps across visits.
  await expect
    .poll(() =>
      page.evaluate((key) => window.localStorage.getItem(key), progressKey),
    )
    .toBe('{"storage":{"frostbite.levels.v1":"{\\"sats\\":3}"}}');

  await page.reload();
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await expect
    .poll(() =>
      gameFrame(page).evaluate(() => [
        localStorage.getItem("frostbite.levels.v1"),
        localStorage.getItem("not-kept"),
      ]),
    )
    .toEqual(['{"sats":3}', null]);
});

test("the game is cut off from the network and the platform's cookies", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await page.evaluate(() => {
    document.cookie = "platform_marker=1; path=/";
  });
  const results = await gameFrame(page).evaluate(async () => {
    const attempt = async (action: () => unknown) => {
      try {
        await action();
        return "allowed";
      } catch {
        return "blocked";
      }
    };
    return {
      cookie: await attempt(() => {
        if (document.cookie.length > 0) throw new Error("readable");
      }),
      fetch: await attempt(() => fetch("/api/v1/platform")),
      run: await attempt(() => fetch("/api/run", { method: "POST" })),
    };
  });
  expect(results).toEqual({
    cookie: "blocked",
    fetch: "blocked",
    run: "blocked",
  });
});

test("the platform page says what the game is: simulated, asking only for what the platform grants", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.locator('[data-testid="game-frame"]')).toBeAttached();
  await openDock(page, "What it asks for");
  await expect(page.getByText("Submit a finished run")).toBeVisible();
  await expect(
    page.getByText("Your progress is kept in this browser only."),
  ).toBeVisible();
});

test("a mark the game makes shows on the platform as reached, and stays after a reload; a mark nobody declared does not", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expect(page.getByText("Connected to the platform")).toBeVisible();
  await openDock(page, "Milestones");
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "0 of 3 reached",
  );
  // The game calls this when the player wins; here it is called directly, since winning a board is chance.
  await gameFrame(page).evaluate(() => {
    const host = (
      window as unknown as { FrostbiteHost: { milestone(mark: string): void } }
    ).FrostbiteHost;
    host.milestone("firstWin");
    host.milestone("firstBust");
  });
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "1 of 3 reached",
  );
  await expect(page.locator('[data-milestone="first-win"]')).toContainText(
    "Reached",
  );
  await expect(page.locator('[data-milestone="first-glacier"]')).toContainText(
    "Not yet",
  );
  await page.reload();
  await openDock(page, "Milestones");
  await expect(page.getByTestId("milestone-summary")).toHaveText(
    "1 of 3 reached",
  );
});
