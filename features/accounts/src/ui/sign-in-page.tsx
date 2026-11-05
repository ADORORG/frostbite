import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import type { WalletNetwork } from "@frostbite/wallet/contracts";
import { AppShell } from "@repo/ui/arcade";

import { SignInSurface } from "../sign-in/sign-in-surface.tsx";
import { networkName } from "../widget/format.ts";

// What signing in comes to, as three steps. They say only what is true of every method: you choose how, you prove it is you (with no
// money moving and nothing sent on chain), and you are taken back to where you were going.
const steps = [
  ["1", "Pick a key", "Wallet, passkey or email, whichever you have to hand."],
  [
    "2",
    "Prove it is you",
    "You sign a message or enter a code. No fee, nothing on chain.",
  ],
  ["3", "Back to the game", "You land on the page you came for."],
] as const;

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
    <AppShell homeHref="/" navigation={navigation}>
      <section className="sign-in-page">
        <div className="sign-in-intro">
          <p className="arcade-eyebrow">Player login</p>
          <h1>Sign in</h1>
          <p className="sign-in-intro__lead">
            Your progress, milestones and collectibles live on your account.
            Connecting a wallet alone does not sign you in; you prove it is
            yours by signing a message.
          </p>
          <ol className="sign-in-steps">
            {steps.map(([number, title, detail]) => (
              <li key={number}>
                <span aria-hidden="true" className="sign-in-steps__number">
                  {number}
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </li>
            ))}
          </ol>
          <p className="sign-in-network">
            <span aria-hidden="true" className="sign-in-network__dot" />
            Network · {networkName(expectedNetwork)}
          </p>
        </div>
        <SignInSurface expectedNetwork={expectedNetwork} offered={offered} />
      </section>
    </AppShell>
  );
}
