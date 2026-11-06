import {
  createCreatorAdmissionService,
  createDrizzleCreatorAdmissionRepository,
} from "@frostbite/creator-admission";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { creatorReviewQueueLimits } from "@frostbite/shared/creator-admission";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { authorizationPolicy } from "@repo/config/authorization";

let service: ReturnType<typeof createCreatorAdmissionService> | undefined;

export function getCreatorAdmissionService() {
  if (service) return service;
  const database = createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(process.env)),
  );
  service = createCreatorAdmissionService({
    authorizationPolicy,
    clock: () => new Date(),
    createId: createUuidV7,
    queuePageSize: creatorReviewQueueLimits.pageSize,
    repository: createDrizzleCreatorAdmissionRepository(database),
  });
  return service;
}
