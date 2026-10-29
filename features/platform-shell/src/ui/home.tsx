import { SceneBackdrop } from "@ador/scenes/react";
import {
  AppShell,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";
import type { FeatureId } from "@ador/shared/features";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import type { ReactNode } from "react";

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
  const status = [
    ["Features", `${registeredFeatures} REGISTERED`],
    ...(hasLaunches ? [["Launches", "GATED"]] : []),
  ] as const;

  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Adorbitals beta foundation"
      homeHref="#top"
      navigation={navigation}
    >
      <div className="home-hero">
        <SceneBackdrop />
        <div aria-hidden="true" className="home-hero__scrim" />
        <section className="arcade-hero">
          <div className="arcade-hero-copy">
            <StatusLamp label="Foundation build in progress" tone="attention" />
            <h1>Launch your legacy. Mint the future.</h1>
            <p>
              A self-custodial launchpad and game arcade for Bitcoin Alkanes.
              Transactional actions stay gated until their product decisions and
              end-to-end checks pass.
            </p>
            <div className="arcade-actions">
              {hasLaunches ? (
                <ArcadeButton href="/launches" tone="red">
                  Explore launches
                </ArcadeButton>
              ) : null}
              {hasGames ? (
                <ArcadeButton href="/games" tone="cyan">
                  Enter arcade
                </ArcadeButton>
              ) : null}
            </div>
          </div>
          <ArcadePanel eyebrow="System status" title="The Well">
            <dl className="arcade-score-grid">
              {status.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </ArcadePanel>
        </section>
      </div>
      {sections.map(({ id, node }) => (
        <div key={id}>{node}</div>
      ))}
    </AppShell>
  );
}
