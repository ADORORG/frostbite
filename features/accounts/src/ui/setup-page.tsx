import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { AppShell } from "@repo/ui/arcade";

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
    <AppShell
      brand="Adorbitals"
      footerLabel="Setup"
      homeHref="/"
      navigation={navigation}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Platform</p>
        <h1>First-time setup</h1>
        <SetupSurface expectedNetwork={expectedNetwork} offered={offered} />
      </section>
    </AppShell>
  );
}
