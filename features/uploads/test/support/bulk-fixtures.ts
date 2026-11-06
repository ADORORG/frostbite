import { ApiError } from "@frostbite/client-http";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { vi } from "vitest";

import { fakeServices } from "./dom.tsx";
import { libraryAsset, processedAsset } from "./library-fixtures.ts";

export const names = (count: number) =>
  Array.from({ length: count }, (_, at) => `piece-${at + 1}.png`);

// Services where every file gets its own intent and asset, and every asset is processed as soon as it
// is asked about. `active` is how many intents are reserved but not yet completed, the number the server
// limits; `peak` is the most there ever were at once.
export function batchServices(
  overrides: { fail?: (name: string) => boolean; refuse?: boolean } = {},
) {
  const base = fakeServices();
  const assetByIntent = new Map<string, string>();
  const created: { fileName: string | undefined; key: string }[] = [];
  const counts = { active: 0, peak: 0 };
  const services = {
    ...base,
    api: {
      ...base.api,
      completeIntent: vi.fn(async ({ intentId }: { intentId: string }) => {
        counts.active -= 1;
        const id = createUuidV7();
        assetByIntent.set(intentId, id);
        return {
          asset: { id, processingState: "pending-validation" as const },
        };
      }),
      createIntent: vi.fn(async (input, { idempotencyKey }) => {
        created.push({ fileName: input.fileName, key: idempotencyKey });
        if (input.fileName !== undefined && overrides.fail?.(input.fileName))
          throw new ApiError("network", null, "offline");
        counts.active += 1;
        counts.peak = Math.max(counts.peak, counts.active);
        const intent = await base.api.createIntent(input, { idempotencyKey });
        const id = createUuidV7();
        return { ...intent, intent: { ...intent.intent, id } };
      }),
      listAssets: vi.fn(async () => ({
        assets: [...assetByIntent.values()].map((id) =>
          overrides.refuse === true
            ? libraryAsset({
                id,
                processingState: "rejected",
                rejectionReason: "dimensions-exceeded",
              })
            : processedAsset({ id }),
        ),
        nextCursor: null,
      })),
    },
  };
  return { counts, created, services };
}
