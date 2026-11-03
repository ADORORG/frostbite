import { expect, test } from "@playwright/test";

import { dockButton, openDock } from "./support/dock.ts";
import { installFakeWallet } from "./support/fake-wallet.ts";
import { testWallets } from "@ador/auth/test-fixtures";
import { expectConnectedToPlatform } from "./support/platform-connection.ts";

// The SDK explorer, played in the platform's isolated frame: every call of the game SDK answered by the real
// platform page, and the events the platform sends on its own. The platform lists the explorer only when run
// for tests or development.
const frameSelector = '[data-testid="game-frame"]';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/games/sdk-explorer");
});

const newest = (page: import("@playwright/test").Page) =>
  page.frameLocator(frameSelector).locator("#log li").first();

test("every call is answered by the platform, in the real frame", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  await game.locator("#capabilities").click();
  await expect(newest(page)).toContainText(
    '"granted":["milestone:claim","run:submit","wallet"]',
  );
  await expect(newest(page)).toContainText('"events":[');
  await game.locator("#player").click();
  await expect(newest(page)).toContainText(
    'player.info → {"signedIn":false,"walletConnected":false}',
  );
  // No wallet is connected in a test browser, so the answer is none, not an error.
  await game.locator("#wallet").click();
  await expect(newest(page)).toHaveText('wallet.get → {"wallet":null}');
  // Asking for a claim is answered, not refused: no wallet is connected in a test browser, so the page says there is none to claim with.
  await game.locator("#milestones-claim").click();
  await expect(newest(page)).toHaveText(
    'milestones.claim → {"reason":"no-wallet","status":"unavailable"}',
  );
  await game.locator("#progress-save").click();
  await expect(newest(page)).toHaveText(
    'progress.save → {"saved":{"calls":1}}',
  );
  await game.locator("#progress-save").click();
  await expect(newest(page)).toHaveText(
    'progress.save → {"saved":{"calls":2}}',
  );
  await game.locator("#milestones-unlock").click();
  await expect(newest(page)).toContainText('"status":"unlocked"');
  await game.locator("#milestones-list").click();
  await expect(newest(page)).toContainText('"status":"unlocked"');
  // A repeatable milestone is counted again, up to the manifest's maximum of five.
  for (let press = 0; press < 6; press += 1)
    await game.locator("#milestones-unlock").click();
  await game.locator("#milestones-counts").click();
  await expect(newest(page)).toContainText(
    '{"current":null,"count":5,"id":"first-call","max":5,"target":null}',
  );
});

test("a message from the game is shown by the platform under the game's name", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  await game.locator("#toast").click();
  await expect(newest(page)).toHaveText('ui.toast → {"shown":true}');
  await expect(page.getByTestId("milestone-toast")).toHaveText(
    "SDK Explorer: Hello from the SDK explorer",
  );
});

test("the platform says what the game can see of a wallet, and that none is connected", async ({
  page,
}) => {
  await expectConnectedToPlatform(page);
  const wallet = await openDock(page, "Wallet");
  await expect(wallet).toContainText("No wallet is connected.");
  // The game's page asks the app's own wallet chooser to open; it has none of its own.
  await wallet.getByRole("button", { name: "Connect a wallet" }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose your wallet" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const asks = await openDock(page, "What it asks for");
  await expect(asks).toContainText("See the address of the wallet");
  await expect(asks).toContainText("Available");
});

test("a game asks for the wallet chooser, the player connects, and the game is told through the event", async ({
  page,
}) => {
  // Connecting a wallet changes no account, so any test wallet will do.
  await installFakeWallet(page, testWallets[0]);
  await page.goto("/games/sdk-explorer");
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  await game.locator("#wallet-connect").click();
  await expect(newest(page)).toHaveText(
    'wallet.connect → {"status":"requested"}',
  );
  const chooser = page.getByRole("dialog", { name: "Choose your wallet" });
  await expect(chooser).toBeVisible();
  await chooser
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  await expect(chooser).not.toBeVisible();
  await expect(
    game.locator('#log li[data-source="event"]').first(),
  ).toContainText(
    `event wallet.changed {"wallet":{"address":"${testWallets[0].address}"`,
  );
  await game.locator("#wallet-connect").click();
  await expect(newest(page)).toHaveText(
    'wallet.connect → {"status":"already-connected"}',
  );
});

test("the platform tells the game when the tab is hidden and shown again", async ({
  page,
}) => {
  await expectConnectedToPlatform(page);
  await page.evaluate(() => {
    const set = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: hidden,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set(true);
    set(false);
  });
  const log = page
    .frameLocator(frameSelector)
    .locator('#log li[data-source="event"]');
  await expect(log).toHaveText([
    'event lifecycle.changed {"state":"active"}',
    'event lifecycle.changed {"state":"paused"}',
  ]);
});

test("a game that did not declare the wallet is refused it, in the real browser", async ({
  page,
}) => {
  await page.goto("/games/frostbite");
  await expectConnectedToPlatform(page);
  const frame = page
    .frames()
    .find((candidate) =>
      candidate.url().endsWith("/play/frostbite/index.html"),
    );
  if (frame === undefined) throw new Error("The game's frame is missing.");
  const answer = await frame.evaluate(
    () =>
      new Promise<{ code: string; ok: boolean }>((resolve) => {
        const listener = (event: MessageEvent) => {
          const data = event.data as {
            id?: string;
            ok?: boolean;
            error?: { code: string };
          };
          if (data.id !== "probe-1") return;
          window.removeEventListener("message", listener);
          resolve({ code: data.error?.code ?? "", ok: data.ok === true });
        };
        window.addEventListener("message", listener);
        const send = (id: string, method: string, params: object) =>
          window.parent.postMessage(
            { channel: "ador-game", id, method, params, version: 1 },
            "*",
          );
        send("probe-0", "ready", { sdkVersion: 1 });
        send("probe-1", "wallet.get", {});
      }),
  );
  expect(answer).toEqual({ code: "permission_denied", ok: false });
});

test("progress toward a target is held by the platform, shown on the page, and earns the milestone at the target", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  for (let press = 1; press <= 4; press += 1) {
    await game.locator("#milestones-progress").click();
    await expect(newest(page)).toContainText(`"current":${String(press)}`);
  }
  const dock = await openDock(page, "Milestones");
  await expect(dock.locator('[data-milestone="ten-presses"]')).toContainText(
    "4 of 10",
  );
  // The open panel covers the game, so it is closed before the game is played on, as a player would.
  await page.keyboard.press("Escape");
  await expect(dockButton(page, "Milestones")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  for (let press = 5; press <= 10; press += 1)
    await game.locator("#milestones-progress").click();
  await expect(newest(page)).toContainText('"status":"unlocked"');
  const reopened = await openDock(page, "Milestones");
  await expect(
    reopened.locator('[data-milestone="ten-presses"]'),
  ).toContainText("Reached");
  await dockButton(page, "Milestones").click();
  // Reported again, the total stays at the target.
  await game.locator("#milestones-progress").click();
  await expect(newest(page)).toContainText('"current":10');
});

test("an earned milestone can be claimed from the dock, and the page says what is missing instead of pretending", async ({
  page,
}) => {
  const game = page.frameLocator(frameSelector);
  await expect(game.locator("#status")).toHaveText(
    "Connected. Call anything below.",
  );
  await game.locator("#milestones-unlock").click();
  await expect(newest(page)).toContainText('"status":"unlocked"');
  const dock = await openDock(page, "Milestones");
  // Nothing to claim with: no wallet is connected in a test browser, and the platform is not asked.
  await dock.getByRole("button", { name: "Claim First call" }).click();
  await expect(dock.getByRole("alert")).toHaveText(
    "Connect a wallet to claim.",
  );
  // The claims the player has, and what a claim costs, are said in their own section.
  const claims = await openDock(page, "Claims");
  await expect(claims).toContainText(
    "You have not claimed anything from this game.",
  );
  await expect(claims).toContainText("You pay the network fee to claim.");
});
