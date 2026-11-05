"use client";

import { WalletRoot } from "@frostbite/feature-accounts/widget";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// The wallet widget for this app. Pages are rendered on the server, so after the player signs out the page must be rendered again
// to show what a signed-out visitor may see (the navigation, or the sign-in page in place of a private one); the framework's router
// does that without losing the widget's own state.
export function WalletShell(
  props: Omit<ComponentProps<typeof WalletRoot>, "onSignedOut">,
) {
  const router = useRouter();
  return <WalletRoot {...props} onSignedOut={() => router.refresh()} />;
}
