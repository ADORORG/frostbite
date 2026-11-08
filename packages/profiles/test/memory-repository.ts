import type { ProfileRepository, StoredProfile } from "../src/repository.ts";

// The profiles in a map, for the service's unit tests: it keeps the one rule the table keeps (a name key belongs to one player).
export function memoryRepository(): ProfileRepository & {
  readonly rows: Map<string, StoredProfile>;
} {
  const rows = new Map<string, StoredProfile>();
  const holder = (key: string) =>
    [...rows.values()].find((row) => row.nameKey === key) ?? null;
  return {
    delete: async (userId) => rows.delete(userId),
    find: async (userId) => rows.get(userId) ?? null,
    findPublic: async (key) => {
      const row = holder(key);
      return row?.visible === true ? row : null;
    },
    holderOf: async (key) => holder(key)?.userId ?? null,
    rows,
    save: async (profile) => {
      const taken = holder(profile.nameKey);
      if (taken !== null && taken.userId !== profile.userId)
        return { kind: "name-taken" };
      rows.set(profile.userId, profile);
      return { kind: "saved" };
    },
  };
}
