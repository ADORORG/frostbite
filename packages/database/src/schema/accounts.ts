import {
  accountStatuses,
  organizationRoles,
  platformRoles,
} from "@ador/shared/accounts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

export const accountStatus = platformSchema.enum(
  "account_status",
  accountStatuses,
);
export const organizationRole = platformSchema.enum(
  "organization_role",
  organizationRoles,
);
export const platformRole = platformSchema.enum("platform_role", platformRoles);
export const accountAuditAction = platformSchema.enum("account_audit_action", [
  "organization-created",
  "membership-created",
  "membership-updated",
]);

// How a platform role came to change, for the evidence in `platform_role_events`.
export const platformRoleEventAction = platformSchema.enum(
  "platform_role_event_action",
  ["granted", "reinstated", "suspended"],
);
export const platformRoleEventVia = platformSchema.enum(
  "platform_role_event_via",
  ["role-screen", "setup-link"],
);

export const organizations = platformSchema.table(
  "organizations",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    status: accountStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (table) => [
    check(
      "organizations_name_nonempty",
      sql`length(${table.name}) > 0 and ${table.name} = btrim(${table.name})`,
    ),
  ],
);

export const organizationMemberships = platformSchema.table(
  "organization_memberships",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: organizationRole("role").notNull(),
    status: accountStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_user_id_idx").on(table.userId),
    index("organization_memberships_org_role_status_idx").on(
      table.organizationId,
      table.role,
      table.status,
    ),
  ],
);

export const platformRoleAssignments = platformSchema.table(
  "platform_role_assignments",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: platformRole("role").notNull(),
    status: accountStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("platform_role_assignments_user_role_unique").on(
      table.userId,
      table.role,
    ),
    index("platform_role_assignments_role_status_idx").on(
      table.role,
      table.status,
    ),
  ],
);

export const accountAuditEvents = platformSchema.table(
  "account_audit_events",
  {
    id: uuid("id").primaryKey(),
    action: accountAuditAction("action").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    previousRole: organizationRole("previous_role"),
    previousStatus: accountStatus("previous_status"),
    nextRole: organizationRole("next_role").notNull(),
    nextStatus: accountStatus("next_status").notNull(),
    policyVersion: text("policy_version").notNull(),
    reasonCode: text("reason_code").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("account_audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "account_audit_events_policy_version_nonempty",
      sql`length(${table.policyVersion}) > 0 and ${table.policyVersion} = btrim(${table.policyVersion})`,
    ),
    check(
      "account_audit_events_reason_code_valid",
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9-]{2,63}$'`,
    ),
  ],
);

// Every change to who holds a platform role, in the transaction that made it: who did it, to whom, from what to what, and by which
// route. A repeated request that changes nothing writes nothing.
export const platformRoleEvents = platformSchema.table(
  "platform_role_events",
  {
    id: uuid("id").primaryKey(),
    action: platformRoleEventAction("action").notNull(),
    // The person who made the change; for a setup link, the person who used it.
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    role: platformRole("role").notNull(),
    previousStatus: accountStatus("previous_status"),
    nextStatus: accountStatus("next_status").notNull(),
    via: platformRoleEventVia("via").notNull(),
    policyVersion: text("policy_version").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("platform_role_events_target_created_idx").on(
      table.targetUserId,
      table.createdAt,
    ),
    check(
      "platform_role_events_policy_version_nonempty",
      sql`length(${table.policyVersion}) > 0 and ${table.policyVersion} = btrim(${table.policyVersion})`,
    ),
  ],
);

// The one-time links an operator mints to make the first administrator. Only a hash of the token is kept: the database alone cannot
// redeem a link. A link is spent when `consumed_at` is set, and void when `revoked_at` is (a newer link replaces it).
export const platformSetupLinks = platformSchema.table(
  "platform_setup_links",
  {
    id: uuid("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date", withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(
      () => authUsers.id,
      { onDelete: "restrict" },
    ),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("platform_setup_links_token_hash_unique").on(table.tokenHash),
    check(
      "platform_setup_links_token_hash_valid",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "platform_setup_links_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "platform_setup_links_consumption_consistent",
      sql`(${table.consumedAt} is null) = (${table.consumedByUserId} is null)`,
    ),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership =
  typeof organizationMemberships.$inferSelect;
export type PlatformRoleAssignment =
  typeof platformRoleAssignments.$inferSelect;
export type AccountAuditEvent = typeof accountAuditEvents.$inferSelect;
