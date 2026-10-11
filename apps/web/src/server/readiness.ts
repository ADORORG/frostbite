import { databaseReadinessProbe } from "@ador/database/connection";
import { runReadiness } from "@ador/http/readiness";
import { storageReadinessProbe } from "@ador/object-storage/readiness";
import type { Readiness } from "@ador/shared/readiness";

import { platformComposition } from "../../../../configs/platform";
import { getDatabase } from "./database";

// Whether the web service can take traffic: the database and object storage answer. What went wrong is
// logged here and never returned, because the answer is public. The workflow provider is checked by the
// worker, which is the one that talks to it.
export function getReadiness(): Promise<Readiness> {
  return runReadiness(
    [
      databaseReadinessProbe({
        execute: (query) => getDatabase().execute(query),
      }),
      {
        check: async (signal) =>
          storageReadinessProbe(
            await platformComposition.providers.resolve(
              "object-storage:s3-compatible",
            ),
          ).check(signal),
        name: "object-storage",
      },
    ],
    {
      onFailure: (name, error) =>
        console.error(`readiness: ${name} is not ready: ${error.message}`),
    },
  );
}
