import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";
import { loadFonts } from "./support/quality.ts";

const authenticatedSurfaces = [
  {
    heading: "Account",
    path: "/account",
    snapshot: "account",
    token: creatorE2EFixtures.visualUser.sessionToken,
  },
  {
    heading: "Creator studio",
    path: "/studio",
    snapshot: "studio",
    token: creatorE2EFixtures.visualUser.sessionToken,
  },
  {
    heading: "Apply to create",
    path: "/studio/creator-application",
    snapshot: "creator-application",
    token: creatorE2EFixtures.visualUser.sessionToken,
  },
  {
    // An approved creator's application is read-only: the status card and what was sent, no form.
    heading: "Apply to create",
    path: "/studio/creator-application",
    snapshot: "creator-application-approved",
    token: creatorE2EFixtures.collectionQualityList.sessionToken,
  },
  {
    // A reviewer asked for changes: their message sits between the status and the form.
    heading: "Apply to create",
    path: "/studio/creator-application",
    snapshot: "creator-application-feedback",
    token: creatorE2EFixtures.applicantFeedback.sessionToken,
  },
  {
    heading: "Admin console",
    path: "/admin",
    snapshot: "admin",
    token: creatorE2EFixtures.staff.sessionToken,
  },
] as const;

for (const surface of authenticatedSurfaces) {
  test(`${surface.snapshot} closes the Week 2 experience-quality matrix`, async ({
    baseURL,
    context,
    page,
  }) => {
    if (baseURL === undefined) throw new Error("Expected configured base URL");
    await useE2ESession(context, baseURL, surface.token);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(surface.path);

    await expect(
      page.getByRole("heading", { exact: true, level: 1, name: surface.heading }),
    ).toBeVisible();
    // Pages that load their content in the browser are checked once it has loaded, not while it loads.
    await expect(page.getByText(/^Loading /u)).toHaveCount(0);
    await expect(page.locator(".scanlines")).toHaveCSS("display", "none");
    await expect(page.locator(".app-shell")).toHaveJSProperty(
      "scrollWidth",
      await page.locator(".app-shell").evaluate((shell) => shell.clientWidth),
    );

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.locator("#main-content").blur();
    await loadFonts(page);
    await page.addStyleTag({
      content: [
        ".skip-link { visibility: hidden !important; }",
        ".status-lamp__light { box-shadow: none !important; }",
      ].join("\n"),
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`${surface.snapshot}.png`, {
      animations: "disabled",
      fullPage: true,
      mask: [page.locator(".status-lamp__light")],
    });
  });
}
