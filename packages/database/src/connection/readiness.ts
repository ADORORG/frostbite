import type { ReadinessProbe } from "@ador/shared/readiness";
import { sql, type SQL } from "drizzle-orm";

// The database answers a trivial query. It proves the connection, the credentials and the pool, not the schema.
export function databaseReadinessProbe(database: {
  readonly execute: (query: SQL) => PromiseLike<unknown>;
}): ReadinessProbe {
  return {
    check: async () => {
      await database.execute(sql`select 1`);
    },
    name: "database",
  };
}
