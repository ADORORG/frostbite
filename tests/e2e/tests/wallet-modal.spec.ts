import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { walletButton } from "./support/fake-wallet.ts";

test("wallet chooser contains focus, explains availability, and closes with Escape", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The chooser opens from the header of any page, not from a page of its own.
  await page.goto("/");
  const trigger = walletButton(page);
  await expect(trigger).toHaveText("Connect wallet");
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Choose your wallet" });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Connect Phantom", exact: true }),
  ).toBeDisabled();
  await expect(
    modal.getByRole("link", { name: "Install Phantom" }),
  ).toHaveCount(0);
  await expect(
    modal.getByText("Unavailable on signet", { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await modal.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(modal.locator("li button:enabled").first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    modal.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error("Expected modal viewport geometry");
  expect(bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(
    await modal.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await expect(modal).toHaveScreenshot("wallet-chooser.png");
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await expect(modal).not.toBeVisible();
});
