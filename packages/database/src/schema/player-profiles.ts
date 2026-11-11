import { sql } from "drizzle-orm";
import { boolean, check, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A player's public profile: the name and picture they chose, and whether the page is shown. A player has at most one, and none until they
// make it: nothing is copied from the account, so no email or wallet text can end up as a name. `name_key` is the name in lower case and
// is unique, so "Ada" and "ada" cannot both exist; it is the table that settles two players choosing the same name together. Deleting the
// row, or the account, frees the name. `name_changed_at` is when the name last changed (the first choice counts), which is what the
// change cooldown reads. The page is opt-in: `visible` is what makes it public.
export const playerProfiles = platformSchema.table(
  "player_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull().unique(),
    avatar: text("avatar").notNull(),
    visible: boolean("visible").notNull(),
    nameChangedAt: timestamp("name_changed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    check(
      "player_profiles_name_key_is_lower",
      sql`${table.nameKey} = lower(${table.name})`,
    ),
    check(
      "player_profiles_name_bounded",
      sql`char_length(${table.name}) between 1 and 32`,
    ),
    check(
      "player_profiles_name_plain",
      sql`${table.name} ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'`,
    ),
    check(
      "player_profiles_changed_after_created",
      sql`${table.nameChangedAt} >= ${table.createdAt}`,
    ),
  ],
);
