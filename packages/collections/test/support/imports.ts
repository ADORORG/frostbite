import type { CollectionImportRow } from "@ador/shared/collections";

import { repository, seedAsset } from "./database.ts";
import { mutation, newId } from "./fixtures.ts";
import type { seeded } from "./items.ts";

// An item image the owner uploaded under a file name, already processed.
export const imageNamed = (ownerUserId: string, fileName: string) =>
  seedAsset(ownerUserId, "collection-item-artwork", "processed", fileName);

export function runImport(
  seed: Awaited<ReturnType<typeof seeded>>,
  rows: readonly CollectionImportRow[],
  context: Partial<ReturnType<typeof mutation>> & {
    dryRun?: boolean;
    itemLimit?: number;
  } = {},
) {
  const { dryRun = false, itemLimit = 100, ...rest } = context;
  return repository.importItems({
    ...mutation(seed.ownerUserId),
    collectionId: seed.collectionId,
    dryRun,
    itemLimit,
    rows: rows.map((row) => ({ itemId: newId(), row })),
    ...rest,
  });
}
