import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the collection pages: the platform shell, the studio's notices, and one section
// with the page heading. Both pages use it, so they cannot drift apart.
export function StudioFrame({
  actions,
  children,
  heading,
  intro,
  navigation,
}: {
  // The page's main action, shown beside its heading (for example "New collection").
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly heading: string;
  readonly intro: string;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Collections beta"
      homeHref="/"
      navigation={navigation}
      notices={["◆ PRIVATE DRAFTS", "▲ NOTHING PUBLISHED", "★ NO CHAIN ACTION"]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Studio</p>
        <h1>{heading}</h1>
        <p>{intro}</p>
        {actions === undefined ? null : (
          <div className="page-actions">{actions}</div>
        )}
        {children}
      </section>
    </AppShell>
  );
}
