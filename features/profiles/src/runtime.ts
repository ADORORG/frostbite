import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import {
  assertProfilePolicy,
  createDrizzleProfileRepository,
  createProfilesService,
  type ProfilePolicy,
} from "@frostbite/profiles";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";

import { createProfileData } from "./profile-data.ts";

// The account side of profiles: one connection pool, made on first use, with the service over the profiles table and the reader of a
// profile page's records. A policy that cannot work stops the first request, not the platform's start.
export function createProfilesResolver(
  policy: ProfilePolicy,
  listedGames: ReadonlySet<string>,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () => {
    assertProfilePolicy(policy);
    const database = createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    );
    return {
      data: createProfileData(database, listedGames),
      service: createProfilesService({
        clock: () => new Date(),
        policy,
        repository: createDrizzleProfileRepository(database),
      }),
    };
  });
}
export type ProfilesRuntime = Awaited<
  ReturnType<ReturnType<typeof createProfilesResolver>>
>;
