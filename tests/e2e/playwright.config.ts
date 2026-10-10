import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

import { resolveE2EServerConfig } from "./src/server-config.ts";

const { baseURL, port: serverPort } = resolveE2EServerConfig(
  process.env.E2E_BASE_URL,
);
// Real-service flows are slow, so only the desktop project runs them; every project runs the rest.
const desktopOnlySpecs =
  /(?:uploads(?:-acceptance(?:-api)?)?|collections(?:-access)?-api|collections-wizard|collections-review)\.spec\.ts$/u;
const repositoryRoot = resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
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
