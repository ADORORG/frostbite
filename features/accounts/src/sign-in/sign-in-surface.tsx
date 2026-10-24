"use client";

import { returnTarget } from "@ador/shared/auth/sign-in-path";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { ArcadePanel } from "@repo/ui/arcade";

import { signInViews } from "./registry.ts";
import { selectSignInViews, type SignInView } from "./views.ts";

// A full navigation, so everything on the page (the header's wallet, the navigation) is read again under the new session.
const assign = (path: string): void => window.location.assign(path);

// Every way to sign in that the deployment offers, each in its own panel. What is offered comes from the server's method registry;
// `views` is how each kind is shown.
export function SignInSurface({
  expectedNetwork,
  navigate = assign,
  offered,
  views = signInViews,
}: {
  readonly expectedNetwork: WalletNetwork;
  // How to go to a page; the destination is checked by `returnTarget`, which only ever gives a path on this site.
  readonly navigate?: (path: string) => void;
  readonly offered: readonly string[];
  readonly views?: readonly SignInView[];
}) {
  const shown = selectSignInViews(offered, views);
  if (shown.length === 0)
    return <p role="status">Signing in is not available right now.</p>;
  return (
    <>
      {shown.map(({ Component, kind, label }) => (
        <ArcadePanel eyebrow="Sign in with" key={kind} title={label}>
          <Component
            expectedNetwork={expectedNetwork}
            onSignedIn={() => navigate(returnTarget(window.location.search))}
          />
        </ArcadePanel>
      ))}
    </>
  );
}
