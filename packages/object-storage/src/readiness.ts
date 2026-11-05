import type { ReadinessProbe } from "@frostbite/shared/readiness";

import { parseObjectKey, type ObjectStoragePort } from "./contracts.ts";

// A key no one writes. Asking about it proves the endpoint, the credentials and the bucket without reading or
// changing anything: a missing object is the expected, healthy answer.
const sentinelKey = parseObjectKey("health/readiness-probe");

export function storageReadinessProbe(
  storage: Pick<ObjectStoragePort, "head">,
): ReadinessProbe {
  return {
    check: async () => {
      await storage.head({ key: sentinelKey, scope: "private" });
    },
    name: "object-storage",
  };
}
