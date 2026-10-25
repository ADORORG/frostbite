import {
  createDrizzleRoleAdministration,
  createDrizzleRoleDirectory,
  createRoleAdministration,
  createRoleDirectory,
} from "@ador/authorization";
import { parseAuthSessionEnvironment } from "@repo/config/env";

import { createHeldMethodKinds } from "../held-method-kinds.ts";
import type { AccountMethods, SetupRules } from "../runtime.ts";
import { database } from "../shared-database.ts";
import type { RoleServices } from "./operations.ts";

// The role screen's services, made when a request first needs them. Who holds a role, and what each account is called, come from the
// platform's rules and the sign-in method registry; nothing here knows a method.
export function createRoleServicesResolver(
  methods: AccountMethods,
  rules: SetupRules,
): () => RoleServices {
  let services: RoleServices | undefined;
  return () => {
    if (services) return services;
    const roleRules = {
      heldKinds: createHeldMethodKinds(methods),
      requiredMethods: rules.requiredMethods,
    };
    services = {
      administration: createRoleAdministration({
        clock: () => new Date(),
        policy: { version: rules.policyVersion },
        repository: createDrizzleRoleAdministration(database(), roleRules),
      }),
      directory: createRoleDirectory({
        repository: createDrizzleRoleDirectory(database(), {
          ...roleRules,
          label: methods.label,
          lookup: methods.lookup,
        }),
      }),
      recentAuthenticationWindowMs: parseAuthSessionEnvironment(process.env)
        .PASSKEY_RECENT_AUTH_WINDOW_MS,
    };
    return services;
  };
}
