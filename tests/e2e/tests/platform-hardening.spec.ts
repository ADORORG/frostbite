import { readinessSchema } from "@ador/shared/readiness";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { signIn } from "../src/upload-helpers.ts";

// What a deployment relies on, checked on the built app with real services: it says whether it is ready, every
// response carries its security headers, and no page breaks the content security policy it reports against.
// Desktop only.

test("the web service says it is ready, naming each check and nothing else", async ({
  request,
}) => {
  const response = await request.get("/api/ready");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const readiness = readinessSchema.parse(await response.json());
  expect(readiness.status).toBe("ready");
  expect(readiness.checks.map(({ name, status }) => [name, status])).toEqual([
    ["database", "ok"],
    ["object-storage", "ok"],
  ]);
});

test("every response carries the security headers, and the policy reports rather than blocks until it is enforced", async ({
  request,
}) => {
  for (const path of ["/", "/games", "/api/v1/platform"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy-report-only"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["content-security-policy"]).toBeUndefined();
    // The platform is plain http here, so no HTTPS-only header is sent.
    expect(headers["strict-transport-security"]).toBeUndefined();
  }
});

test("a new nonce comes with every page", async ({ request }) => {
  const nonces = await Promise.all(
    [1, 2].map(
      async () =>
        /nonce-([^']+)/u.exec(
          (await request.get("/games")).headers()[
            "content-security-policy-report-only"
          ] ?? "",
        )?.[1],
    ),
  );
  expect(nonces[0]).toBeDefined();
  expect(nonces[0]).not.toBe(nonces[1]);
});

test("pages and the studio break no part of the policy they report against, except one known probe of the wallet library", async ({
  baseURL,
  page,
}) => {
  const violations: { message: string; path: string }[] = [];
  let current = "";
  page.on("console", (message) => {
    if (/content security policy|report only/iu.test(message.text()))
      violations.push({ message: message.text(), path: current });
  });
  const visit = async (path: string) => {
    current = path;
    await page.goto(path);
    await expect(
      page.locator("main, [role=main], #main-content").first(),
    ).toBeVisible();
  };
  for (const path of ["/", "/games", "/games/frostbite", "/collections"])
    await visit(path);
  await signIn(page, baseURL, creatorE2EFixtures.collectionWizardCreator);
  for (const path of [
    "/studio",
    "/studio/collections",
    "/studio/uploads",
    "/account",
  ])
    await visit(path);
  // The wallet library tests whether script evaluation is allowed (and copes when it is not). The header wallet
  // widget mounts it on every page, so that probe is reported everywhere and is the only thing the policy reports;
  // anything else is a page that would break once the policy is enforced.
  expect(
    violations.filter(
      ({ message }) => !/Evaluating a string as JavaScript/u.test(message),
    ),
  ).toEqual([]);
});

test("a person who does too much of one thing is told to slow down, with how long to wait", async ({
  baseURL,
  page,
}) => {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  // Signed in but not an approved creator: every attempt is refused, so nothing is created, yet each is counted.
  await signIn(page, baseURL, creatorE2EFixtures.rateLimitProbe);
  const attempt = (n: number) =>
    page.request.post("/api/v1/collection-drafts", {
      data: { not: "a draft" },
      headers: {
        "idempotency-key": `rate-limit-attempt-${String(n).padStart(8, "0")}`,
        origin: new URL(baseURL).origin,
      },
    });
  // Twenty a minute are allowed for this operation.
  const statuses: number[] = [];
  for (let n = 0; n < 20; n += 1) statuses.push((await attempt(n)).status());
  expect(statuses).not.toContain(429);
  const refused = await attempt(20);
  expect(refused.status()).toBe(429);
  expect(Number(refused.headers()["retry-after"])).toBeGreaterThanOrEqual(1);
  expect((await refused.json()).error.code).toBe("rate_limited");
  // Another operation of the same person is not affected.
  expect(
    (await page.request.get("/api/v1/collection-drafts")).status(),
  ).not.toBe(429);
});
