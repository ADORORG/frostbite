import type { BrowserContext } from "@playwright/test";
import { platformSessionCookieName } from "@frostbite/shared/auth";

export type E2ESessionContext = Pick<
  BrowserContext,
  "addCookies" | "clearCookies"
>;

export async function useE2ESession(
  context: E2ESessionContext,
  baseURL: string,
  token: string,
): Promise<void> {
  await context.clearCookies();
  const url = new URL(baseURL);
  await context.addCookies([
    {
      domain: url.hostname,
      httpOnly: true,
      name: platformSessionCookieName,
      path: "/",
      sameSite: "Lax",
      secure: true,
      value: token,
    },
  ]);
}
