import type { PlatformRole } from "@ador/shared/accounts";

// Who holds platform roles, and finding a person to give one to. For administrators only (the caller checks); it shows what an administrator
// needs to be sure it is the right person and nothing more: a name taken from a sign-in method the account holds, the roles, and whether
// each works.

export interface DirectoryRole {
  // Whether the role works now: active, and the account holds the sign-in methods the policy asks of it.
  readonly effective: boolean;
  readonly role: PlatformRole;
  readonly status: "active" | "suspended";
}

export interface DirectoryEntry {
  readonly label: string;
  readonly roles: readonly DirectoryRole[];
  readonly userId: string;
}

export interface RoleDirectoryRepository {
  // Every account that has ever held a platform role, in a fixed order.
  holders(): Promise<readonly DirectoryEntry[]>;
  // The accounts a typed address, wallet address or account id names, exactly. At most `limit` of them.
  find(text: string, limit: number): Promise<readonly DirectoryEntry[]>;
}

const MAXIMUM_QUERY_LENGTH = 200;
const MAXIMUM_RESULTS = 10;

export function createRoleDirectory(dependencies: {
  readonly repository: RoleDirectoryRepository;
}) {
  const { repository } = dependencies;
  return {
    holders: () => repository.holders(),
    // Nothing is returned for an empty or absurdly long query: a lookup names a person, it does not list people.
    async find(text: string): Promise<readonly DirectoryEntry[]> {
      const query = text.trim();
      if (query === "" || query.length > MAXIMUM_QUERY_LENGTH) return [];
      return repository.find(query, MAXIMUM_RESULTS);
    },
  };
}

export type RoleDirectory = ReturnType<typeof createRoleDirectory>;
