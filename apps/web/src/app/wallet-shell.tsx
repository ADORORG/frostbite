"use client";

import { WalletRoot } from "@ador/feature-accounts/widget";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// The wallet widget for this app. Pages are rendered on the server, so after the player signs in or out the page
// must be rendered again to show what the new session may see (the navigation, or "Authentication required" on a
// private page); the framework's router does that without losing the widget's own state.
export function WalletShell(
  props: Omit<ComponentProps<typeof WalletRoot>, "onSessionChange">,
) {
  const router = useRouter();
  return <WalletRoot {...props} onSessionChange={() => router.refresh()} />;
}
