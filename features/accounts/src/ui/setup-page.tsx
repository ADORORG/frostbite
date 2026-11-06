import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import type { WalletNetwork } from "@frostbite/wallet/contracts";
import { PageFrame } from "@repo/ui/arcade";

import { SetupSurface } from "../setup/setup-surface.tsx";

// The page a setup link opens. Public, because the person may not be signed in yet and the link's token lives in the address
// fragment, which the server never sees: the page signs them in itself and keeps the token meanwhile.
export function SetupPage({
  expectedNetwork,
  navigation,
  offered,
}: {
  readonly expectedNetwork: WalletNetwork;
  readonly navigation: readonly NavigationItem[];
  readonly offered: readonly string[];
}) {
  return (
    <PageFrame
      eyebrow="Platform"
      heading="First-time setup"
      intro="Finish setting up the platform with the single-use link its operator made."
      navigation={navigation}
    >
      <SetupSurface expectedNetwork={expectedNetwork} offered={offered} />
    </PageFrame>
  );
}
