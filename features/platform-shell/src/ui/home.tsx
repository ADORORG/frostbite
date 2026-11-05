import { Fragment } from "react";
import { AppShell } from "@repo/ui/arcade";
import type { FeatureId } from "@frostbite/shared/features";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
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
  sections = [],
}: {
  readonly navigation: readonly NavigationItem[];
  readonly registeredFeatureIds: readonly FeatureId[];
  readonly sections?: readonly HomeSectionView[];
}) {
  const hasLaunches = registeredFeatureIds.includes("launches");
  const hasGames = registeredFeatureIds.includes("games");

  return (
    <AppShell homeHref="#top" navigation={navigation}>
      <HomeHero
        hasCollections={registeredFeatureIds.includes("collections")}
        hasGames={hasGames}
        hasLaunches={hasLaunches}
      />
      <div className="home-sections">
        {sections.map(({ id, node }) => (
          <Fragment key={id}>{node}</Fragment>
        ))}
      </div>
    </AppShell>
  );
}
