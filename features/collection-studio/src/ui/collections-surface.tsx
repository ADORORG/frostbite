import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { ChainOption } from "@ador/shared/chain";

import { collectionNewPath } from "@ador/shared/collections";
import { ArcadeButton } from "@repo/ui/arcade";

import { CollectionsWorkspace } from "./collections-workspace.tsx";
import { StudioFrame } from "./studio-frame.tsx";

// The studio page listing the creator's collection drafts. A server component: everything interactive
// lives behind the workspace's client boundary.
export function CollectionsSurface({
  navigation,
  targetChains,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly targetChains: readonly ChainOption[];
}) {
  return (
    <StudioFrame
      actions={
        <ArcadeButton href={collectionNewPath} tone="mint">
          New collection
        </ArcadeButton>
      }
      heading="Collections"
      intro="Everything you are building, and where each collection stands. Nothing is published, and nothing is sent to a chain, from here."
      navigation={navigation}
    >
      <CollectionsWorkspace targetChains={targetChains} />
    </StudioFrame>
  );
}
