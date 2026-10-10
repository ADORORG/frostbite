import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { ChainOption } from "@ador/shared/chain";

import { NewCollectionWorkspace } from "./new-collection-workspace.tsx";
import { StudioFrame } from "./studio-frame.tsx";

// The studio page that starts a collection: one short form, then the wizard takes over.
export function NewCollectionSurface({
  navigation,
  targetChains,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly targetChains: readonly ChainOption[];
}) {
  return (
    <StudioFrame
      heading="New collection"
      intro="Start with a name, a supply, and a chain. You add the description, images, and items next, and your draft is saved as you go."
      navigation={navigation}
    >
      <NewCollectionWorkspace targetChains={targetChains} />
    </StudioFrame>
  );
}
