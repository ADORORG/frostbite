export { createDrizzleProfileRepository } from "./drizzle-repository.ts";
export { nameKeyOf, nameProblem, normalizedForBlocklist } from "./name.ts";
export { assertProfilePolicy, type ProfilePolicy } from "./policy.ts";
export type {
  ProfileRepository,
  SaveOutcome,
  StoredProfile,
} from "./repository.ts";
export {
  createProfilesService,
  type NameCheck,
  type ProfilesService,
  type SaveResult,
} from "./service.ts";
