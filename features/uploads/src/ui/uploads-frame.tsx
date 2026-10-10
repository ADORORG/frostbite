import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the uploads pages: the platform shell, the uploads notices, and one section with
// the page heading. Both pages use it, so they cannot drift apart. A server component.
export function UploadsFrame({
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
      footerLabel="Uploads beta"
      homeHref="/"
      navigation={navigation}
      notices={[
        "◆ PRIVATE DRAFTS",
        "▲ CHECKED ON THE SERVER",
        "★ NOTHING PUBLISHED",
      ]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Studio</p>
        <h1>{heading}</h1>
        <p>{intro}</p>
        {children}
      </section>
    </AppShell>
  );
}
