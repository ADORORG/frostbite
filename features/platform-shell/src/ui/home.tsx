import {
  AppShell,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";
import type { FeatureId } from "@ador/shared/features";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

export function PlatformHome({
  registeredFeatureIds,
  registeredFeatures,
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly registeredFeatureIds: readonly FeatureId[];
  readonly registeredFeatures: number;
}) {
  const hasLaunches = registeredFeatureIds.includes("launches");
  const hasGames = registeredFeatureIds.includes("games");
  const status = [
    ["Features", `${registeredFeatures} REGISTERED`],
    ["Network", "UNSET"],
    ...(hasLaunches ? [["Launches", "GATED"]] : []),
    ...(hasGames ? [["Games", "01 PLANNED"]] : []),
  ] as const;

  return (
    <AppShell
      brand="Adorbitals"
      footerLabel="Adorbitals beta foundation"
      homeHref="#top"
      navigation={navigation}
    >
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
      {hasLaunches ? (
        <section className="arcade-section" id="launches">
          <p className="arcade-eyebrow">01 / Launchpad</p>
          <h2>Fair launches without hidden controls.</h2>
          <p>
            No live sale is configured. Wallet, eligibility, transaction, and
            indexing flows will appear only after their release gates pass.
          </p>
        </section>
      ) : null}
      {hasGames ? (
        <section className="arcade-section arcade-section--raised" id="games">
          <p className="arcade-eyebrow">02 / Arcade</p>
          <h2>One template. Many on-chain worlds.</h2>
          <article className="arcade-game-card">
            <span className="arcade-game-number">001</span>
            <div>
              <h3>Frostbite</h3>
              <p>First playable world · integration pending</p>
            </div>
            <span className="arcade-chip">COMING ONLINE</span>
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
