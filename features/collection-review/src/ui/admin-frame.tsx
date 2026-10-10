import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the review pages: the platform shell, the staff notices, and one section with
// the page heading. Both pages use it, so they cannot drift apart.
export function AdminFrame({
  children,
  heading,
  intro,
  navigation,
}: {
  readonly children: ReactNode;
  readonly heading: string;
  readonly intro: string;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Collection reviews"
      homeHref="/"
      navigation={navigation}
      notices={["◆ STAFF ONLY", "▲ NOTHING PUBLISHED", "★ NO CHAIN ACTION"]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Admin</p>
        <h1>{heading}</h1>
        <p>{intro}</p>
        {children}
      </section>
    </AppShell>
  );
}
