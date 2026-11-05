import { walletNetworks } from "@frostbite/shared/chain";
import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// The CHECK that keeps a wallet's network to the ones the platform knows (`walletNetworks`, the one list). The names are fixed
// words of our own, never input, so they are written into the statement; a migration records them as they were that day.
export function networkInList(column: AnyPgColumn): SQL {
  return sql`${column} in (${sql.raw(walletNetworks.map((name) => `'${name}'`).join(", "))})`;
}
