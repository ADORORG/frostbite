import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { PageFrame } from "@repo/ui/arcade";

import { SignInSurface } from "../sign-in/sign-in-surface.tsx";
import { networkName } from "../widget/format.ts";

// The sign-in page. A visitor sent here from a protected page is brought back to it afterwards (the `returnTo` in the address); one
// who is already signed in is taken on at once. Connecting a wallet alone is not signing in, and the page says so once.
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
    <PageFrame
      eyebrow="Account"
      footerLabel="Sign in"
      heading="Sign in"
      intro={`Choose how. You prove it is you by signing a message or entering a code, with no fee and nothing on chain; a connected wallet alone does not sign you in. Network: ${networkName(expectedNetwork)}.`}
      navigation={navigation}
    >
      <SignInSurface expectedNetwork={expectedNetwork} offered={offered} />
    </PageFrame>
  );
}
