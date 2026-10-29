import { AppShell } from "@repo/ui/arcade";
import type { FeatureId } from "@ador/shared/features";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { ReactNode } from "react";

import { HomeHero } from "./home-hero.tsx";

// A part of the landing page a feature supplied, already drawn.
export interface HomeSectionView {
  readonly id: string;
  readonly node: ReactNode;
}

// The landing page: a hero over a moving scene, then whatever parts the features supplied (a rail of games, of collections, of
// launches), in the order they asked for. The shell knows none of them; a feature appears here by contributing a part.
export function PlatformHome({
  navigation,
  registeredFeatureIds,
  registeredFeatures,
  sections = [],
}: {
  readonly navigation: readonly NavigationItem[];
  readonly registeredFeatureIds: readonly FeatureId[];
  readonly registeredFeatures: number;
  readonly sections?: readonly HomeSectionView[];
}) {
  const hasLaunches = registeredFeatureIds.includes("launches");
  const hasGames = registeredFeatureIds.includes("games");

  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Adorbitals beta foundation"
      homeHref="#top"
      navigation={navigation}
    >
      <HomeHero
        hasCollections={registeredFeatureIds.includes("collections")}
        hasGames={hasGames}
        hasLaunches={hasLaunches}
        registeredFeatures={registeredFeatures}
      />
      {sections.map(({ id, node }) => (
        <div key={id}>{node}</div>
      ))}
    </AppShell>
  );
}
