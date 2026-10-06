import { randomBytes } from "node:crypto";

import { createUuidV7 } from "@ador/shared/identifiers";
import {
  createDrizzleUploadIntentRepository,
  createUploadIntentService,
} from "@ador/uploads";

import type { UploadsContext } from "./context.ts";

export function createUploadServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
) {
  let service:
    Promise<ReturnType<typeof createUploadIntentService>> | undefined;
  return () => {
    service ??= resolveContext()
      .then(({ database, storage }) =>
        createUploadIntentService({
          clock: () => new Date(),
          createDraftKey: () => randomBytes(32).toString("hex"),
          createId: createUuidV7,
          repository: createDrizzleUploadIntentRepository(database),
          storage,
        }),
      )
      .catch((error: Error) => {
        service = undefined;
        throw error;
      });
    return service;
  };
}
