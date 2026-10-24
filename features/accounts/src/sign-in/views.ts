import type { WalletNetwork } from "@ador/wallet/contracts";
import type { ComponentType } from "react";

// How a person signs in with one kind of method, on the sign-in page. The server decides which kinds the deployment offers (the
// method registry); a view only says how that kind looks and works. Adding a method to the page is one view added to
// `signInViews` (./registry.ts): the page, the surface and this selection are not edited.
export interface SignInViewProps {
  readonly expectedNetwork: WalletNetwork;
  // Called once the server has said the person is signed in.
  readonly onSignedIn: () => void;
}

export interface SignInView {
  readonly Component: ComponentType<SignInViewProps>;
  // The method's kind, as the method registry names it.
  readonly kind: string;
  // The heading of the method's panel.
  readonly label: string;
}

// The views to show: those of the kinds the server offers, in the server's order. A kind offered with no view is left out (nothing
// is shown that cannot be used) and a view for a kind that is not offered is never shown.
export function selectSignInViews(
  offered: readonly string[],
  views: readonly SignInView[],
): readonly SignInView[] {
  return offered.flatMap((kind) => {
    const view = views.find((candidate) => candidate.kind === kind);
    return view === undefined ? [] : [view];
  });
}
