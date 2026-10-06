import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { platformSessionCookieName } from "@ador/shared/auth";
import {
  qualificationChallengeSchema,
  qualificationRoutes,
} from "@ador/shared/wallet-qualification";
import {
  signWalletMessage,
  walletAddress,
} from "../../../packages/auth/test/support/fixtures.ts";

declare global {
  interface Window {
    qualificationSign(message: string, scheme: string): Promise<string>;
  }
}

// Deterministic extension transport only. Signing/server verification are real; this is not
// physical UniSat evidence and no test signer is included in production code or bundles.
test("qualification signs and verifies without a session, and recovers from rejection", async ({
  page,
  context,
}) => {
  let rejectSigning = true;
  await page.exposeFunction(
    "qualificationSign",
    (message: string, scheme: string) => {
      expect(scheme).toBe("bip322-simple");
      if (rejectSigning) throw new Error("User rejected the request");
      return signWalletMessage(message);
    },
  );
  await page.addInitScript(
    ({ address }) => {
      Object.defineProperty(window, "unisat", {
        value: {
          requestAccounts: async () => [address],
          getAccounts: async () => [address],
          getPublicKey: async () => "02" + "11".repeat(32),
          getChain: async () => ({ enum: "BITCOIN_SIGNET" }),
          getBalance: async () => ({ confirmed: 0, unconfirmed: 0, total: 0 }),
          on: () => undefined,
          removeListener: () => undefined,
          signMessage: (message: string, scheme: string) =>
            window.qualificationSign(message, scheme),
        },
      });
    },
    { address: walletAddress },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/connect");
  await page
    .getByRole("button", { name: "Choose wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect UniSat", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Message signing qualification",
  });
  const button = panel.getByRole("button", {
    name: "Test message signing",
    exact: true,
  });
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("status")).toContainText(
    "The test did not complete.",
  );
  await expect(button).toBeEnabled();
  await expect(panel).toHaveScreenshot("wallet-message-rejected.png");
  rejectSigning = false;
  const challengeResponse = page.waitForResponse((response) =>
    response.url().endsWith(qualificationRoutes.begin.path),
  );
  const verificationResponse = page.waitForResponse((response) =>
    response.url().endsWith(qualificationRoutes.verify.path),
  );
  await button.click();
  const challenge = qualificationChallengeSchema.parse(
    await (await challengeResponse).json(),
  );
  await expect(panel.getByRole("status")).toContainText(
    "Signature verified by the server. No session created.",
  );
  const verificationHeaders = await (await verificationResponse).allHeaders();
  expect(verificationHeaders["set-cookie"]).toBeUndefined();
  expect(
    (await context.cookies()).filter(
      ({ name }) => name === platformSessionCookieName,
    ),
  ).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(panel).toHaveScreenshot("wallet-message-qualification.png");
  const replay = await page.request.post(qualificationRoutes.verify.path, {
    headers: { origin: new URL(page.url()).origin },
    data: {
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature: signWalletMessage(challenge.message),
    },
  });
  expect(replay.status()).toBe(400);
  expect(replay.headers()["set-cookie"]).toBeUndefined();
});

test("qualification rejects cross-origin, tampered, and invalid inputs", async ({
  request,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Expected configured test origin");
  const data = {
    address: walletAddress,
    provider: "xverse",
    network: "signet",
  };
  expect(
    (
      await request.post(qualificationRoutes.begin.path, {
        data,
        headers: { origin: "https://attacker.example" },
      })
    ).status(),
  ).toBe(403);
  const response = await request.post(qualificationRoutes.begin.path, {
    data,
    headers: { origin: baseURL },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const challenge = qualificationChallengeSchema.parse(await response.json());
  const tampered = await request.post(qualificationRoutes.verify.path, {
    headers: { origin: baseURL },
    data: {
      challengeId: challenge.challengeId,
      message: challenge.message + " tampered",
      signature: signWalletMessage(challenge.message + " tampered"),
    },
  });
  expect(tampered.status()).toBe(400);
  const invalid = await request.post(qualificationRoutes.begin.path, {
    headers: { origin: baseURL },
    data: { ...data, provider: "not-configured" },
  });
  expect(invalid.status()).toBe(400);
});
