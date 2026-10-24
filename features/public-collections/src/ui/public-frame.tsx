import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The frame of the public collection pages: the platform shell, and one section. Both pages and every state
// use it, so they cannot drift apart. `wall` is wide, for a page of covers; `catalog` is the narrower page of a single message.
export function PublicFrame({
  children,
  navigation,
  variant = "catalog",
}: {
  readonly children: ReactNode;
  readonly navigation: readonly NavigationItem[];
  readonly variant?: "catalog" | "wall";
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Public discovery"
      homeHref="/"
      navigation={navigation}
    >
      <section className={`arcade-section arcade-section--${variant}`}>
        {children}
      </section>
    </AppShell>
  );
}
