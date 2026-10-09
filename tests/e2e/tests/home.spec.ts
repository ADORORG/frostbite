import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("shows only honest foundation-stage launchpad controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /launch your legacy/i }),
  ).toBeVisible();
  await expect(page.getByText("No live sale is configured")).toBeVisible();
  await expect(page.getByRole("link", { name: /connect wallet/i })).toHaveCount(
    0,
  );
});

test("serves the arcade design stylesheet in the production build", async ({
  page,
}) => {
  const stylesheetStatuses: number[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "stylesheet") {
      stylesheetStatuses.push(response.status());
    }
  });

  await page.goto("/");

  await expect(page.locator(".app-shell")).toHaveCSS(
    "background-image",
    /radial-gradient/,
  );
  expect(stylesheetStatuses).not.toContain(404);
});

test("navigates to the truthful empty games catalog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Enter arcade" }).click();

  await expect(page).toHaveURL(/\/games$/);
  await expect(
    page.getByRole("heading", { name: "No games online" }),
  ).toBeVisible();
});

test("keeps shell navigation keyboard-accessible at every viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});

test("removes decorative scanlines when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".scanlines")).toHaveCSS("display", "none");
});

test("has no automatically detectable WCAG 2.2 AA violations", async ({
  page,
}) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("matches the reviewed arcade shell baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page).toHaveScreenshot("arcade-shell.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("serves the versioned platform contract with correlated truthful state", async ({
  request,
}) => {
  const correlationId = "123e4567-e89b-42d3-a456-426614174000";
  const response = await request.get("/api/v1/platform", {
    headers: { "x-correlation-id": correlationId },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["x-correlation-id"]).toBe(correlationId);
  // The exact feature count is asserted against the registry in the web integration tests.
  expect(await response.json()).toEqual({
    apiVersion: "v1",
    registeredFeatures: expect.any(Number),
    stage: "foundation",
    transactionalActions: "gated",
  });
});

test("serves every public catalog and validates detail identifiers", async ({
  page,
}) => {
  for (const path of ["launches", "collections", "creators", "games"]) {
    await page.goto(`/${path}`);
    await expect(page.getByText("Catalog empty")).toBeVisible();
  }
  await page.goto("/games/frostbite");
  await expect(page.getByText("Record not published")).toBeVisible();
  await page.goto("/games/Frostbite");
  await expect(page.getByText("Invalid identifier")).toBeVisible();
});

test("keeps public discovery accessible and reduced-motion safe", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/collections");
  await expect(page.locator(".scanlines")).toHaveCSS("display", "none");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("matches the public discovery visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/launches");
  await expect(page).toHaveScreenshot("public-discovery.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("serves a generated domain-independent OpenAPI contract", async ({
  request,
}) => {
  const response = await request.get("/api/v1/openapi");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    openapi: "3.1.0",
    paths: {
      "/api/v1/platform": {
        get: { operationId: "getPlatformStatus" },
      },
    },
  });
  expect(JSON.stringify(await response.json())).not.toContain('"servers"');
});

test("keeps authenticated route content closed without a session", async ({
  page,
}) => {
  for (const path of [
    "/account",
    "/studio",
    "/admin",
    "/studio/creator-application",
    "/admin/creator-applications",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Authentication required")).toBeVisible();
    await expect(page.getByText(/session active/i)).toHaveCount(0);
    await expect(page.locator(".app-shell")).toBeVisible();
  }
});

test("keeps protected-route state accessible and keyboard navigable", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("honors reduced motion on protected-route states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio");
  await expect(page.locator(".scanlines")).toHaveCSS("display", "none");
});

test("matches the protected-route visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio");
  await expect(page).toHaveScreenshot("protected-route.png", {
    animations: "disabled",
    fullPage: true,
  });
});
