import { expect, type Page } from "@playwright/test";

// The game bar says the game is connected to the platform. On a narrow screen it keeps the status dot and hides the words, which stay
// in the status for a screen reader, so the words are read from the status itself, not looked for on the screen.
export async function expectConnectedToPlatform(page: Page): Promise<void> {
  await expect(
    page.getByRole("status").filter({ hasText: /Connected to the platform/u }),
  ).toHaveText("Connected to the platform");
}
