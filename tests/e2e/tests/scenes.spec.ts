import { expect, test } from "@playwright/test";

// The moving scenes and the page around them, at every project's viewport (phone, tablet, desktop).

// The smallest phones are narrower than any project's screen, so the widths are set here.
for (const width of [320, 360, 390]) {
  test(`fits a ${String(width)} pixel screen: no sideways scroll, and the header's buttons are all inside it`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 740, width });
    await page.goto("/");
    const fit = await page.evaluate(() => {
      const edge = document.documentElement.clientWidth;
      const outside = [
        ...document.querySelectorAll(
          ".app-header :is(a, button, summary, .app-header__status)",
        ),
      ].filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          element.checkVisibility() && box.width > 0 && box.right > edge + 0.5
        );
      });
      return {
        edge,
        outside: outside.map((element) => element.textContent?.trim() ?? ""),
        scroll: document.documentElement.scrollWidth,
      };
    });
    expect(fit.scroll).toBe(fit.edge);
    expect(fit.outside).toEqual([]);
  });
}

test("keeps the motion switch small, in view, and working", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Animations" });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.height).toBeLessThan(32);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    viewport?.width ?? 0,
  );
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Motion off");
  // The person's choice is kept for the next visit.
  await page.reload();
  await expect(page.getByRole("button", { name: "Animations" })).toHaveText(
    "Motion off",
  );
});

test("keeps still when reduced motion is requested, and says so", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Animations" });
  await expect(toggle).toHaveText("Motion off");
  const frame = () =>
    page.evaluate(
      () =>
        document.querySelector<HTMLCanvasElement>("canvas")?.toDataURL() ?? "",
    );
  // Let the first frame be drawn, then check that no later one is.
  await page.waitForTimeout(1500);
  const first = await frame();
  expect(first).not.toBe("");
  await page.waitForTimeout(1200);
  expect(await frame()).toBe(first);
});

test("plays a scene on the landing page when motion is welcome", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Animations" }),
  ).toHaveAttribute("aria-pressed", "true");
  const frame = () =>
    page.evaluate(
      () =>
        document
          .querySelector<HTMLCanvasElement>(".home-hero canvas")
          ?.toDataURL() ?? "",
    );
  const first = await frame();
  await expect.poll(frame, { timeout: 5000 }).not.toBe(first);
});

test("falls back to the scene's video in a browser that cannot draw", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  const page = await context.newPage();
  await page.goto("/");
  const video = page.locator(".home-cabinet video");
  await expect(video).toHaveCount(1);
  await expect(video.locator("source")).toHaveCount(2);
  await expect(page.locator("canvas")).toHaveCount(0);
  // The snow behind the words falls back too: its own video, so the page looks the same.
  await expect(page.locator(".home-hero__sky video")).toHaveCount(1);
  await context.close();
});
