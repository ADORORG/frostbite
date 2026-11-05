import type { DomainEventEnvelope } from "@frostbite/events";
import {
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { platformSchema } from "./platform.ts";

export const outboxStatus = platformSchema.enum("outbox_status", [
  "pending",
  "delivering",
  "delivered",
  "failed",
]);

export const outboxEvents = platformSchema.table(
  "outbox_events",
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    causationId: uuid("causation_id"),
    correlationId: uuid("correlation_id").notNull(),
    deliveredAt: timestamp("delivered_at", {
      mode: "date",
      withTimezone: true,
    }),
    eventId: uuid("event_id").primaryKey(),
    eventName: text("event_name").notNull(),
    failureReason: text("failure_reason"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    leaseId: uuid("lease_id"),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    payload: jsonb("payload").$type<DomainEventEnvelope["payload"]>().notNull(),
    schemaVersion: integer("schema_version").notNull(),
    status: outboxStatus("status").notNull().default("pending"),
  },
  (table) => [
    check("outbox_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check(
      "outbox_delivery_lease_consistent",
      sql`(${table.status} = 'delivering') = (${table.leaseId} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      "outbox_delivered_time_consistent",
      sql`(${table.status} = 'delivered') = (${table.deliveredAt} is not null)`,
    ),
    check(
      "outbox_failed_reason_required",
      sql`${table.status} <> 'failed' or length(btrim(${table.failureReason})) > 0`,
    ),
    check(
      "outbox_name_version_consistent",
      sql`${table.eventName} ~ ('\\.v' || ${table.schemaVersion} || '$')`,
    ),
    check("outbox_schema_version_positive", sql`${table.schemaVersion} > 0`),
    index("outbox_delivery_candidates").on(table.status, table.availableAt),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
