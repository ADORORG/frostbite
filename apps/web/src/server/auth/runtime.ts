import {
  createSessionService,
  createDrizzleSessionRepository,
} from "@ador/auth";
import {
  createAuthorizationService,
  createDrizzleAuthorizationRepository,
} from "@ador/authorization";
import { parseAuthSessionEnvironment } from "@repo/config/env";

import { getDatabase } from "../database";
import { authorizationPolicy } from "../../../../../configs/authorization";
import type { PageAccessDependencies } from "./page-access.ts";

let services: PageAccessDependencies | undefined;

export function getPageAccessDependencies(): PageAccessDependencies {
  if (services) return services;
  const authEnvironment = parseAuthSessionEnvironment(process.env);
  const database = getDatabase();
  const sessions = createSessionService({
    clock: () => new Date(),
    idleLifetimeMs: authEnvironment.AUTH_SESSION_IDLE_TIMEOUT_MS,
    repository: createDrizzleSessionRepository(database),
  });
  const authorization = createAuthorizationService({
    policy: authorizationPolicy,
    repository: createDrizzleAuthorizationRepository(database),
  });
  services = {
    findSession: sessions.find,
    forPlatform: authorization.forPlatform,
  };
  return services;
}
