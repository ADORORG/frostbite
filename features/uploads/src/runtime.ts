import { randomBytes } from "node:crypto";

import { createUuidV7 } from "@ador/shared/identifiers";
import {
  createDrizzleUploadIntentRepository,
  createUploadIntentService,
} from "@ador/uploads";

import type { UploadsContext } from "./context.ts";
import { memoizeUntilFailure } from "./lazy.ts";

export function createUploadServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
) {
  return memoizeUntilFailure(async () => {
    const { database, storage } = await resolveContext();
    return createUploadIntentService({
      clock: () => new Date(),
      createDraftKey: () => randomBytes(32).toString("hex"),
      createId: createUuidV7,
      repository: createDrizzleUploadIntentRepository(database),
      storage,
    });
  });
}
