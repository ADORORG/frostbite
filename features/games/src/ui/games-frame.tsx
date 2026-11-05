import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { AppShell } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The frame of every games page and state: the platform shell and one catalog
// section, so the pages cannot drift apart.
export function GamesFrame({
  children,
  navigation,
  variant = "catalog",
}: {
  readonly children: ReactNode;
  readonly navigation: readonly NavigationItem[];
  // `stage` is the whole screen, for a page built around one thing (a game being played); `wall` is wide, for
  // a page of previews.
  readonly variant?: "catalog" | "stage" | "wall";
}) {
  return (
    <AppShell
      homeHref="/"
      immersive={variant === "stage"}
      navigation={navigation}
    >
      <section className={`arcade-section arcade-section--${variant}`}>
        {children}
      </section>
    </AppShell>
  );
}
