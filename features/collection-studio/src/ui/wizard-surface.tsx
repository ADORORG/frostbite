import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import type { ChainOption } from "@frostbite/shared/chain";

import { CollectionWizard } from "./collection-wizard.tsx";
import { StudioFrame } from "./studio-frame.tsx";

// The studio page for one draft's wizard. The draft is loaded in the browser with the creator's own
// session, so nothing about it is rendered on the server.
export function WizardSurface({
  collectionId,
  navigation,
  targetChains,
}: {
  readonly collectionId: string;
  readonly navigation: readonly NavigationItem[];
  readonly targetChains: readonly ChainOption[];
}) {
  return (
    <StudioFrame
      heading="Collection"
      intro="Your draft is saved as you go and only you can see it. Come back any time to pick up where you left off."
      navigation={navigation}
    >
      <CollectionWizard
        collectionId={collectionId}
        targetChains={targetChains}
      />
    </StudioFrame>
  );
}
