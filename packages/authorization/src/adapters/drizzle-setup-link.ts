import type { DatabaseClient } from "@frostbite/database/connection";
import { platformSetupLinks } from "@frostbite/database/schema/accounts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { and, eq, isNull } from "drizzle-orm";

import type { SetupLinkRepository } from "../application/setup-link.ts";
import {
  activateRole,
  effectiveAdminIds,
  lockRoleChanges,
  type RoleRules,
} from "./role-assignment.ts";

// Minting takes the platform-wide role lock, so two operators minting together cannot leave two working links.
export function createDrizzleSetupLinks(
  database: DatabaseClient,
  rules: RoleRules,
): SetupLinkRepository {
  return {
    mint: (input) =>
      database.transaction(async (transaction) => {
        await lockRoleChanges(transaction);
        if ((await effectiveAdminIds(transaction, rules)).length > 0)
          return { kind: "admin-exists" };
        // The newest link is the only one that works.
        await transaction
          .update(platformSetupLinks)
          .set({ revokedAt: input.now })
          .where(
            and(
              isNull(platformSetupLinks.consumedAt),
              isNull(platformSetupLinks.revokedAt),
            ),
          );
        await transaction.insert(platformSetupLinks).values({
          createdAt: input.now,
          expiresAt: input.expiresAt,
          id: createUuidV7(),
          tokenHash: input.tokenHash,
        });
        return { kind: "minted" };
      }),

    redeem: (input) =>
      database.transaction(async (transaction) => {
        // The row lock on the link is what keeps two people opening it together to one winner; no role can change meanwhile, because
        // changing roles needs an administrator and setup only runs while there is none.
        const [link] = await transaction
          .select()
          .from(platformSetupLinks)
          .where(eq(platformSetupLinks.tokenHash, input.tokenHash))
          .for("update")
          .limit(1);
        if (link === undefined) return { kind: "invalid-link" };
        if (link.consumedByUserId === input.userId)
          return { kind: "already-used-by-you" };
        if (
          link.consumedAt !== null ||
          link.revokedAt !== null ||
          link.expiresAt.getTime() <= input.now.getTime()
        )
          return { kind: "invalid-link" };
        // Setup is over once a working administrator exists; a link minted earlier must not add a second way in.
        if ((await effectiveAdminIds(transaction, rules)).length > 0)
          return { kind: "invalid-link" };
        const held = await rules.heldKinds(transaction, input.userId);
        const missing = (rules.requiredMethods.admin ?? []).filter(
          (needed) => !held.has(needed),
        );
        if (missing.length > 0) return { kind: "needs-method", missing };
        await activateRole(
          transaction,
          { role: "admin", targetUserId: input.userId },
          {
            actorUserId: input.userId,
            correlationId: input.correlationId,
            now: input.now,
            policyVersion: input.policyVersion,
            via: "setup-link",
          },
        );
        await transaction
          .update(platformSetupLinks)
          .set({ consumedAt: input.now, consumedByUserId: input.userId })
          .where(eq(platformSetupLinks.id, link.id));
        return { kind: "granted" };
      }),
  };
}
