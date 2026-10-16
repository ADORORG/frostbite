import type { Page } from "@playwright/test";

// Collects what the page and the game's frame report while a test runs: policy violations (the platform page reports one
// known thing, the wallet library's probe for script evaluation, see the hardening spec; anything else the policy reports,
// in the page or the game's frame, is a failure) and uncaught errors.
export function watch(page: Page) {
  const violations: string[] = [];
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (
      /content security policy/iu.test(text) &&
      !/Evaluating a string as JavaScript/u.test(text)
    )
      violations.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { errors, violations };
}
