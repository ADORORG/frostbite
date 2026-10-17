import { StatusLamp } from "@repo/ui/arcade";
import type { ChainIndexing } from "@ador/shared/chain";

import { lampFor, unreachableLamp } from "../domain/copy.ts";

// The lamp for how far the chain's indexer has read. `null` is the platform not being reachable; where it follows no chain there
// is nothing to show, so nothing is drawn.
export function IndexingLamp({
  indexing,
}: {
  readonly indexing: ChainIndexing | null;
}) {
  if (indexing?.state === "none") return null;
  const lamp = indexing === null ? unreachableLamp : lampFor(indexing);
  return (
    <StatusLamp
      compact
      detail={lamp.detail}
      label={lamp.label}
      tone={lamp.tone}
    />
  );
}
