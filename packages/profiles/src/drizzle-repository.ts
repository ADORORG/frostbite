import type { DatabaseClient } from "@frostbite/database/connection";
import { playerProfiles } from "@frostbite/database/schema/player-profiles";
import { isProfileAvatarId } from "@frostbite/shared/profiles";
import { and, eq } from "drizzle-orm";

import type { ProfileRepository, StoredProfile } from "./repository.ts";

type Row = typeof playerProfiles.$inferSelect;

// The postgres error code for a unique key that would be broken.
const uniqueViolation = "23505";
// The table's own name for its unique key on `name_key`.
const nameKeyConstraint = "player_profiles_name_key_key";

function storedOf(row: Row): StoredProfile {
  /* v8 ignore next -- a stored id that is not a preset only appears if a preset is dropped while profiles keep it. */
  const avatar = isProfileAvatarId(row.avatar) ? row.avatar : "snowman";
  return {
    avatar,
    createdAt: row.createdAt,
    name: row.name,
    nameChangedAt: row.nameChangedAt,
    nameKey: row.nameKey,
    updatedAt: row.updatedAt,
    userId: row.userId,
    visible: row.visible,
  };
}

// Whether a failed statement broke the unique key on the name. The driver wraps the database's error as `cause`.
function brokeNameKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error))
    return false;
  const { cause } = error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === uniqueViolation &&
    "constraint" in cause &&
    cause.constraint === nameKeyConstraint
  );
}

export function createDrizzleProfileRepository(
  database: DatabaseClient,
): ProfileRepository {
  return {
    delete: async (userId) =>
      (
        await database
          .delete(playerProfiles)
          .where(eq(playerProfiles.userId, userId))
          .returning({ userId: playerProfiles.userId })
      ).length > 0,

    find: async (userId) => {
      const [row] = await database
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, userId));
      return row === undefined ? null : storedOf(row);
    },

    findPublic: async (nameKey) => {
      const [row] = await database
        .select()
        .from(playerProfiles)
        .where(
          and(
            eq(playerProfiles.nameKey, nameKey),
            eq(playerProfiles.visible, true),
          ),
        );
      return row === undefined ? null : storedOf(row);
    },

    holderOf: async (nameKey) => {
      const [row] = await database
        .select({ userId: playerProfiles.userId })
        .from(playerProfiles)
        .where(eq(playerProfiles.nameKey, nameKey));
      return row?.userId ?? null;
    },

    save: async (profile) => {
      const values = {
        avatar: profile.avatar,
        name: profile.name,
        nameChangedAt: profile.nameChangedAt,
        nameKey: profile.nameKey,
        updatedAt: profile.updatedAt,
        visible: profile.visible,
      };
      try {
        await database
          .insert(playerProfiles)
          .values({
            ...values,
            createdAt: profile.createdAt,
            userId: profile.userId,
          })
          .onConflictDoUpdate({
            set: values,
            target: playerProfiles.userId,
          });
        return { kind: "saved" };
      } catch (error) {
        if (brokeNameKey(error)) return { kind: "name-taken" };
        throw error;
      }
    },
  };
}
