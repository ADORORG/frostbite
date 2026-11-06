import { expect, type Page } from "@playwright/test";

// The game is shown in an isolated frame that loads and then greets the platform, so "connected" arrives after the page itself, not
// with it. A busy runner (browsers, app, worker, database and Inngest share four CPUs) took over Playwright's 5 s default; a wrong
// connection never arrives at all, so a generous bound costs nothing when the game works.
const connectTimeoutMs = 30_000;

// The game bar says the game is connected to the platform. On a narrow screen it keeps the status dot and hides the words, which stay
// in the status for a screen reader, so the words are read from the status itself, not looked for on the screen.
export async function expectConnectedToPlatform(page: Page): Promise<void> {
  await expect(
    page.getByRole("status").filter({ hasText: /Connected to the platform/u }),
  ).toHaveText("Connected to the platform", { timeout: connectTimeoutMs });
}
