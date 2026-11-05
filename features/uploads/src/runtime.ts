import { randomBytes } from "node:crypto";

import { createUuidV7 } from "@frostbite/shared/identifiers";
import {
  createDrizzleUploadIntentRepository,
  createUploadIntentService,
} from "@frostbite/uploads";

import type { UploadsContext } from "./context.ts";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";

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
