import {
  createSessionService,
  createDrizzleSessionRepository,
} from "@frostbite/auth";
import {
  createAuthorizationService,
  createDrizzleAuthorizationRepository,
} from "@frostbite/authorization";
import { createHeldMethodKinds } from "@frostbite/feature-accounts";
import { parseAuthSessionEnvironment } from "@repo/config/env";

import { getDatabase } from "../database";
import { authMethods } from "@repo/configs/auth-methods";
import { authorizationPolicy } from "@repo/configs/authorization";
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
    repository: createDrizzleAuthorizationRepository(
      database,
      createHeldMethodKinds(authMethods),
    ),
  });
  services = {
    findSession: sessions.find,
    forPlatform: authorization.forPlatform,
  };
  return services;
}
