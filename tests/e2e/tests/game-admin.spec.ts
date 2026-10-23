import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { post } from "../src/upload-api.ts";
import {
  closeMatrix,
  passBreadcrumb,
  prepare,
  skipToMain,
} from "./support/quality.ts";

// Staff administration of games' rewards contracts on the real stack. No chain is configured in a test run, so the pages open and
// say what cannot be done and why: no template can be published and no contract created, and the page tells staff instead of
// pretending. The whole flow with a chain is covered against the simulated chain where the service and the page's states are
// tested.
const explorer = "/admin/games/sdk-explorer";

test("staff see the templates, none published, and the games with rewards", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/admin/games");
  await expect(
    page.getByRole("heading", { level: 1, name: "Game rewards" }),
  ).toBeVisible();
  await expect(
    page.getByText("game-rewards@1.0.0 — Not published"),
  ).toBeVisible();
  await expect(
    page.getByText("milestone-collectible@1.0.0 — Not published"),
  ).toBeVisible();
  await expect(
    page.getByText("No template has been published yet."),
  ).toBeVisible();
  await skipToMain(page);
  await passBreadcrumb(page);
  await expect(
    page.getByRole("link", { name: "Administer SDK Explorer" }),
  ).toBeVisible();
  await closeMatrix(page, "game-admin-list.png");
});

test("a template cannot be published without a network, and the page says so", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto("/admin/games");
  const publish = page.getByRole("button", {
    name: "Publish game-rewards@1.0.0",
  });
  await expect(publish).toBeDisabled();
  await page.getByLabel("Wallet address").fill("tb1qexamplewalletaddress");
  await expect(publish).toBeDisabled();
  // There is no address to type: the platform chooses where the code goes.
  await expect(page.getByLabel("Address for game-rewards@1.0.0")).toHaveCount(
    0,
  );
  await publish.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not available yet" }),
  ).toBeVisible();
});

test("a game's page has no contract to administer yet, and says what comes first", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.staff.sessionToken);
  await page.goto(explorer);
  await expect(
    page.getByRole("heading", { level: 1, name: "SDK Explorer" }),
  ).toBeVisible();
  await expect(page.getByText("has no rewards contract yet")).toBeVisible();
  await expect(page.getByText("not both published yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Publish them first." }),
  ).toBeVisible();
  // There is nothing to pause or define on a game with no contract, and nothing to create it from.
  await expect(page.getByRole("button", { name: "Pause claims" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Create the contract" }),
  ).toHaveCount(0);
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
  const deniedTemplates = await post(
    page.request,
    baseURL,
    "/api/v1/game-admin/templates",
    {},
  );
  expect(deniedTemplates.status()).toBe(403);

  const visitor = await browser.newContext({ baseURL });
  const anonymous = await post(
    visitor.request,
    baseURL,
    "/api/v1/game-admin/list",
    { gameId: "sdk-explorer" },
  );
  expect(anonymous.status()).toBe(401);
  const anonymousTemplates = await post(
    visitor.request,
    baseURL,
    "/api/v1/game-admin/templates",
    {},
  );
  expect(anonymousTemplates.status()).toBe(401);
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
