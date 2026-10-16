import { join } from "node:path";

import { startDevHost, type DevHost } from "@ador/game-sdk/dev-host";
import { expect, test } from "@playwright/test";

// The local test page a builder opens, in a real browser, with the repository's own sample game: the game runs in a sandboxed
// frame, the real host answers it, and the page's panel drives the platform's side (sign-in, wallet, events). Desktop only: it
// is a developer's page, not part of the site.
let host: DevHost;

test.beforeAll(async () => {
  host = await startDevHost({
    directory: join(import.meta.dirname, "../../../games/sample-game"),
    game: {
      capabilities: [],
      id: "sample-game",
      milestones: [
        {
          claimPolicy: "once",
          criteria: "Score 5 taps.",
          description: "Five taps in one run.",
          id: "first-five",
          title: "First five",
        },
      ],
    },
  });
});
test.afterAll(async () => host.close());
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("runs the game in a sandboxed frame, answers it through the real host, and logs the conversation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(host.url);
  await expect(page.getByText("local stand-in", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.locator("#dev-note")).toContainText("made up");
  const game = page.frameLocator("iframe");
  await expect(game.locator("#status")).toHaveText(/Connected/u);
  expect(await page.locator("iframe").getAttribute("sandbox")).toBe(
    "allow-scripts",
  );
  for (let tap = 0; tap < 5; tap += 1) await game.locator("#tap").click();
  await expect(game.locator('[data-milestone="first-five"]')).toBeVisible();
  const log = page.locator("#dev-log");
  await expect(log).toContainText("→ milestones.unlock");
  await expect(log).toContainText("← milestones.unlock");
  // The frame is as isolated here as on the platform: the game's own safety probe finds nothing it can reach.
  await game.locator("#probe").click();
  await expect(game.locator("#probe-result")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("serves the game's files with the platform's headers, so a page that would be blocked there is blocked here", async ({
  request,
}) => {
  // The game is built when the page is loaded, so the page is asked for first.
  await request.get(`${host.url}/`);
  const response = await request.get(`${host.url}/play/sample-game/index.html`);
  expect(response.headers()["content-security-policy"]).toContain(
    "connect-src 'none'",
  );
  expect(
    (
      await request.get(`${host.url}/play/sample-game/../../../etc/passwd`)
    ).status(),
  ).toBe(404);
});

test("lets the builder sign the player in and out, and connect a wallet, and shows each change", async ({
  page,
}) => {
  await page.goto(host.url);
  await expect(page.locator("#dev-panel")).toContainText("Signed out");
  await page.locator("#dev-signin").click();
  await expect(page.locator("#dev-panel")).toContainText("Signed in");
  await page.locator("#dev-wallet").click();
  await expect(page.locator("#dev-panel")).toContainText("on signet");
  await page.locator("#dev-network").selectOption("mainnet");
  await expect(page.locator("#dev-panel")).toContainText("on mainnet");
  await page.locator("#dev-hidden").click();
  await expect(page.locator("#dev-log")).toContainText("lifecycle.changed");
  await page.locator("#dev-signin").click();
  await expect(page.locator("#dev-panel")).toContainText("Signed out");
});
