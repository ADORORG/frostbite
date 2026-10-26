import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { useE2ESession } from "../src/session.ts";

test("links and removes a platform passkey with a real browser ceremony", async ({
  baseURL,
  context,
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "One stateful authenticator journey",
  );
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      automaticPresenceSimulation: true,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: "ctap2",
      transport: "internal",
    },
  });
  const unauthenticated = await request.post(
    "/api/v1/passkeys/registration/options",
    { data: {}, headers: { origin: new URL(baseURL).origin } },
  );
  expect(unauthenticated.status()).toBe(401);
  await useE2ESession(
    context,
    baseURL,
    creatorE2EFixtures.passkeyUser.sessionToken,
  );
  const malformed = await context.request.post(
    "/api/v1/passkeys/registration/verify",
    {
      data: { challengeId: "not-a-uuid", credential: {} },
      headers: { origin: new URL(baseURL).origin },
    },
  );
  expect(malformed.status()).toBe(400);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { exact: true, name: "Account" }),
  ).toBeVisible();
  const optionsResponse = page.waitForResponse((response) =>
    response.url().endsWith("/passkeys/registration/options"),
  );
  await page.getByRole("button", { name: "Add passkey" }).click();
  const issued = await optionsResponse;
  expect(issued.status(), await issued.text()).toBe(200);
  await expect(page.getByText(/Passkey linked/)).toBeVisible();
  await expect(page.getByText("Passkey 1")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/Passkey removed/)).toBeVisible();
  await expect(page.getByText("Passkey 1")).toHaveCount(0);
});
