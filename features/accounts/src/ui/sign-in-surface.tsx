import { AppShell } from "@repo/ui/arcade";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { WalletNetwork } from "@ador/wallet/contracts";

import type { WalletCandidate } from "../wallet-config.ts";
import { WalletSessionPanel } from "./wallet-session-panel.tsx";

// The page where a player connects a wallet and signs in, open to everyone. Signing in here is the only way in; a
// connected wallet alone opens nothing.
export function SignInSurface({
  candidates,
  navigation,
  network,
}: {
  readonly candidates: readonly WalletCandidate[];
  readonly navigation: readonly NavigationItem[];
  readonly network: WalletNetwork;
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Wallet sign-in"
      homeHref="/"
      navigation={navigation}
      notices={[
        "◆ SELF CUSTODY",
        "▲ YOU SIGN, WE VERIFY",
        "★ NO KEYS LEAVE YOUR WALLET",
      ]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Wallet</p>
        <h1>Sign in</h1>
        <p>
          Connect your wallet and sign a message to prove the address is yours.
          Nothing is sent that moves funds, and your keys never leave your
          wallet.
        </p>
        <WalletSessionPanel candidates={candidates} network={network} />
      </section>
    </AppShell>
  );
}
