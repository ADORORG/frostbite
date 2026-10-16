import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { post } from "../src/upload-api.ts";
import {
  closeMatrix,
  passBreadcrumb,
  prepare,
  skipToMain,
} from "./support/quality.ts";

// Staff administration of a game's rewards contract on the real stack. No rewards contract is deployed and no chain is configured
// in a test run, so the pages open and say so: a step cannot be built, and the page tells staff why instead of pretending. The
// whole flow with a chain is covered against the simulated chain where the service and the page's states are tested.
const explorer = "/admin/games/sdk-explorer";

test("staff see the games with rewards and are told, plainly, that none has a contract yet", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/admin/games");
  await expect(
    page.getByRole("heading", { level: 1, name: "Game rewards" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No rewards contract is deployed for this game, so there is nothing to administer yet.",
    ),
  ).toBeVisible();
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Administer SDK Explorer" }),
  ).toBeFocused();
  await closeMatrix(page, "game-admin-list.png");
});

test("a game's page cannot start a step without a contract, and says so", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto(explorer);
  await expect(
    page.getByRole("heading", { level: 1, name: "SDK Explorer" }),
  ).toBeVisible();
  await expect(page.getByText("steps cannot be built yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause claims" }),
  ).toBeDisabled();
  await page.getByLabel("Wallet address").fill("tb1qexamplewalletaddress");
  await page.getByRole("button", { name: "Pause claims" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "not available for this game yet" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing has been done to this game's contract yet."),
  ).toBeVisible();
  await closeMatrix(page, "game-admin-detail.png");
});

test("only staff reach the pages and the routes: a reviewer is turned away, and so is a signed-out visitor", async ({
  baseURL,
  browser,
  page,
}) => {
  test.skip(test.info().project.name !== "desktop", "Desktop only.");
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await page.goto("/admin/games");
  await expect(
    page.getByRole("heading", { name: "Staff clearance required" }),
  ).toBeVisible();
  const denied = await post(page.request, baseURL, "/api/v1/game-admin/list", {
    gameId: "sdk-explorer",
  });
  expect(denied.status()).toBe(403);

  const visitor = await browser.newContext({ baseURL });
  const anonymous = await post(
    visitor.request,
    baseURL,
    "/api/v1/game-admin/list",
    { gameId: "sdk-explorer" },
  );
  expect(anonymous.status()).toBe(401);
  await visitor.close();
});

test("an address that names no game with rewards is 'not found', never an empty form", async ({
  baseURL,
  page,
}) => {
  test.skip(test.info().project.name !== "desktop", "Desktop only.");
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/admin/games/no-such-game");
  await expect(
    page.getByRole("heading", { level: 1, name: "Game not found" }),
  ).toBeVisible();
  await expect(page.getByLabel("Wallet address")).toHaveCount(0);
});
