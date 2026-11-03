import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

import { resolveE2EServerConfig } from "./src/server-config.ts";

const { baseURL, port: serverPort } = resolveE2EServerConfig(
  process.env.E2E_BASE_URL,
);
// Real-service flows are slow, so only the desktop project runs them; every project runs the rest.
const desktopOnlySpecs =
  /(?:uploads(?:-acceptance(?:-api)?)?|collections(?:-access)?-api|collections-(?:wizard(?:-upload)?|bulk-upload|import)|alpha-acceptance|game-hosting|platform-hardening|collections-review)\.spec\.ts$/u;
const repositoryRoot = resolve(import.meta.dirname, "../..");
// Pixel comparison is a separate, on-demand run (E2E_VISUAL=1, the "Visual baselines" workflow): it never gates a merge or a deploy.
// Without it every other check in a spec (behaviour, axe, keyboard, layout measurements) still runs; only the picture comparison is skipped.
const comparePictures = process.env.E2E_VISUAL === "1";
// Browser workers per run. The Verify runner has 4 vCPUs and the app, worker, Postgres and S3 share them with the browsers.
const ciWorkers = Number(process.env.E2E_WORKERS ?? 3);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry tells a flaky test from a broken one; more only multiplies the cost of every real failure.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? ciWorkers : undefined,
  ignoreSnapshots: !comparePictures,
  // A hung run fails in minutes instead of waiting for the job's own limit.
  globalTimeout: process.env.CI ? 25 * 60_000 : undefined,
  reporter: [["html", { open: "never" }]],
  expect: {
    // Applied only while a screenshot is taken (see the file for why).
    toHaveScreenshot: { stylePath: "./screenshot.css" },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile",
      testIgnore: desktopOnlySpecs,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      testIgnore: desktopOnlySpecs,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "wide",
      testIgnore: desktopOnlySpecs,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter web start:standalone",
    cwd: repositoryRoot,
    env: { HOSTNAME: "127.0.0.1", PORT: serverPort },
    reuseExistingServer: false,
    url: baseURL,
  },
});
