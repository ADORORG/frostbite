import {
  createDrizzleSetupLinks,
  createSetupLinkService,
} from "@frostbite/authorization";
import type { DatabaseClient } from "@frostbite/database/connection";
import {
  createHeldMethodKinds,
  type createAuthMethods,
} from "@frostbite/feature-accounts/methods";
import { authorizationPolicy } from "@repo/config/authorization";
import { setupLinkPolicy } from "@repo/config/setup-link";
import { randomBytes } from "node:crypto";

// The same setup-link service the platform runs, over the same rules: the methods an administrator needs come from the platform's
// authorization policy and the sign-in method registry, never from a copy kept here.
export function createSetupLinkServiceFor(
  database: DatabaseClient,
  methods: ReturnType<typeof createAuthMethods>,
) {
  return createSetupLinkService({
    clock: () => new Date(),
    policy: {
      lifetimeMs: setupLinkPolicy.lifetimeMs,
      policyVersion: authorizationPolicy.version,
    },
    randomBytes: (length) => randomBytes(length),
    repository: createDrizzleSetupLinks(database, {
      heldKinds: createHeldMethodKinds(methods),
      requiredMethods: authorizationPolicy.requiredMethods,
    }),
  });
}
