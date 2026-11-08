import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The frame of every profile page and state: the platform shell and one catalog section, so the pages cannot drift apart.
export function ProfilesFrame({
  children,
  navigation,
}: {
  readonly children: ReactNode;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell homeHref="/" navigation={navigation}>
      <section className="arcade-section arcade-section--catalog">
        {children}
      </section>
    </AppShell>
  );
}
