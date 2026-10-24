import type { ReactNode } from "react";

import { AppShell, type ShellNavigationItem } from "./app-shell.tsx";

// The frame every work-area page shares: the platform shell around one raised section that opens with the
// area's eyebrow, the page heading, and a sentence on what the page is for. Each feature wraps this with
// its own footer label, so the layout lives here once and the words stay with the feature.
export function PageFrame({
  children,
  eyebrow,
  footerLabel,
  heading,
  intro,
  navigation,
}: {
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly footerLabel: string;
  readonly heading: string;
  readonly intro: string;
  readonly navigation: readonly ShellNavigationItem[];
}) {
  return (
    <AppShell
      brand="Adorbitals"
      footerLabel={footerLabel}
      homeHref="/"
      navigation={navigation}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
        <p>{intro}</p>
        {children}
      </section>
    </AppShell>
  );
}
