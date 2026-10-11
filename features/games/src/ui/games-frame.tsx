import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The frame of every games page and state: the platform shell with the public notices and one catalog
// section, so the pages cannot drift apart.
export function GamesFrame({
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
        "▲ TRUTHFUL SYSTEM STATE",
        "★ BITCOIN ALKANES",
      ]}
    >
      <section className="arcade-section arcade-section--catalog">
        {children}
      </section>
    </AppShell>
  );
}
