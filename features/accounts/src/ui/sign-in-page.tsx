import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { AppShell } from "@repo/ui/arcade";

import { SignInSurface } from "../sign-in/sign-in-surface.tsx";

// The sign-in page. A visitor sent here from a protected page is brought back to it afterwards (the `returnTo` in the address); one
// who is already signed in is taken on at once.
export function SignInPage({
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
      footerLabel="Sign in"
      homeHref="/"
      navigation={navigation}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Account</p>
        <h1>Sign in</h1>
        <p>
          Choose how you want to sign in. Connecting a wallet alone does not
          sign you in; you prove it is yours by signing a message.
        </p>
        <SignInSurface expectedNetwork={expectedNetwork} offered={offered} />
      </section>
    </AppShell>
  );
}
