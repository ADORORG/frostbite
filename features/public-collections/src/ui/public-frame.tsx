import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The frame of the public collection pages: the platform shell with the public notices, and one
// catalog section. Both pages and every state use it, so they cannot drift apart.
export function PublicFrame({
  children,
  navigation,
}: {
  readonly children: ReactNode;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Public discovery"
      homeHref="/"
      navigation={navigation}
      notices={[
        "◆ VERIFIED PUBLIC RECORDS",
        "▲ APPROVED, NOT LAUNCHED",
        "★ BITCOIN ALKANES",
      ]}
    >
      <section className="arcade-section arcade-section--catalog">
        {children}
      </section>
    </AppShell>
  );
}
