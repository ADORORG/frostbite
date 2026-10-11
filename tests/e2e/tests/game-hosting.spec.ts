import { expect, test, type Page } from "@playwright/test";

import { serveGame } from "../src/game-hosting.ts";

// The same game files, hosted the two ways a game may be: with a host to itself (subdomain style) and under
// a path of a host that shares its domain (domain-path style). One build must work in both. A game that names
// its files from the root of the host works in the first and fails in the second; the last test shows that
// failure, so the passing ones cannot be passing for nothing. Desktop only.
const fixtures = new URL("../fixtures/", import.meta.url).pathname;
const styles = [
  { basePath: undefined, name: "a host to itself (subdomain style)" },
  {
    basePath: "/frostbite",
    name: "a path of a shared host (domain-path style)",
  },
] as const;

async function failedLocalRequests(page: Page, origin: string) {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      failed.push(`${String(response.status())} ${response.url()}`);
  });
  return failed;
}

for (const { basePath, name } of styles) {
  test(`one build works with ${name}`, async ({ page }) => {
    const hosted = await serveGame(`${fixtures}hosted-game`, { basePath });
    try {
      const failed = await failedLocalRequests(
        page,
        new URL(hosted.url).origin,
      );
      await page.goto(hosted.url);
      await expect(
        page.getByRole("heading", { name: "Hosted game fixture" }),
      ).toBeVisible();
      // Its script ran and fetched its data by a relative address.
      await expect(page.locator("#status")).toHaveText("Loaded 3 levels.");
      // Its stylesheet applied.
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(10, 20, 30)",
      );
      // Its image loaded.
      await expect
        .poll(() =>
          page
            .locator("#art")
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(failed).toEqual([]);
      expect(hosted.requests.every(({ status }) => status === 200)).toBe(true);
      // Where it is, as the platform would link to it.
      expect(new URL(page.url()).pathname).toBe(
        basePath === undefined ? "/" : `${basePath}/`,
      );
    } finally {
      await hosted.close();
    }
  });
}

test("a game that names its files from the root of the host fails under a base path, and works with a host to itself", async ({
  page,
}) => {
  const whole = await serveGame(`${fixtures}broken-game`);
  const under = await serveGame(`${fixtures}broken-game`, {
    basePath: "/frostbite",
  });
  try {
    await page.goto(whole.url);
    await expect(page.locator("#status")).toHaveText("Loaded.");
    await page.goto(under.url);
    await expect(page.locator("#status")).toHaveText("Script did not load.");
    expect(
      under.requests
        .filter(({ status }) => status === 404)
        .map(({ path }) => path)
        .sort(),
    ).toEqual(["/main.js", "/styles.css"]);
  } finally {
    await whole.close();
    await under.close();
  }
});
