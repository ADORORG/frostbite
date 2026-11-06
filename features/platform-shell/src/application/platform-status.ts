import type { HttpOperation } from "@frostbite/http";
import {
  platformStatusInputSchema,
  platformStatusRoute,
  platformStatusSchema,
  type PlatformStatus,
  type PlatformStatusInput,
} from "@frostbite/shared/platform";

export function createPlatformStatusOperation(
  registeredFeatures: number,
): HttpOperation<PlatformStatusInput, PlatformStatus> {
  return {
    access: { kind: "public" },
    applicationErrors: [],
    execute: async () => ({
      ok: true,
      value: {
        apiVersion: "v1",
        registeredFeatures,
        stage: "foundation",
        transactionalActions: "gated",
      },
    }),
    idempotency: "none",
    input: "none",
    inputSchema: platformStatusInputSchema,
    method: platformStatusRoute.method,
    cache: { kind: "revalidate" },
    operationId: platformStatusRoute.operationId,
    outputSchema: platformStatusSchema,
    path: platformStatusRoute.path,
  };
}
