import { expect, type Locator, type Page } from "@playwright/test";

// The button for a section of the dock under the game (Milestones, About, What it asks for).
export const dockButton = (page: Page, section: string): Locator =>
  page.getByRole("button", { name: new RegExp(`^${section}`, "u") });

// Opens a section the way a player does, and returns the panel it opened.
export async function openDock(page: Page, section: string) {
  const button = dockButton(page, section);
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const panel = await button.getAttribute("aria-controls");
  return page.locator(`[id="${panel}"]`);
}
