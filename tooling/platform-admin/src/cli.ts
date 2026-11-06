import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { createAuthMethods } from "@frostbite/feature-accounts/methods";
import { parseEnvironment } from "@repo/config/env";
import { parseMailEnvironment } from "@repo/config/mail";

import { exitCodeOf, formatSetupLinkReport, mintSetupLink } from "./link.ts";
import { createSetupLinkServiceFor } from "./services.ts";

// `pnpm platform:setup-link [--env <file>]`: makes the single-use link that creates the first administrator, and prints it here.
const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({ options: { env: { type: "string" } } });
const file = resolve(root, values.env ?? "apps/web/.env.local");
let fromFile: NodeJS.ProcessEnv = {};
try {
  fromFile = parseEnv(readFileSync(file, "utf8"));
} catch {
  console.error(
    `No settings file at ${file}; reading the process environment only.`,
  );
}
const environment = { ...fromFile, ...process.env };
const pool = createDatabasePool(parseDatabaseEnvironment(environment));
try {
  const report = await mintSetupLink({
    baseUrl: parseEnvironment(environment).PUBLIC_BASE_URL,
    service: createSetupLinkServiceFor(
      createDatabaseClient(pool),
      createAuthMethods({ email: parseMailEnvironment(environment) !== null }),
    ),
  });
  console.log(formatSetupLinkReport(report));
  process.exitCode = exitCodeOf(report);
} finally {
  await pool.end();
}
