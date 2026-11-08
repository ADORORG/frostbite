import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import type { ShareConfig } from "@frostbite/share";
import { gamesPath } from "@frostbite/shared/games";
import { profileSetupPath } from "@frostbite/shared/profiles";
import { ArcadeButton, ProfileAvatar } from "@repo/ui/arcade";
import type { ReactNode } from "react";

import { profileCopy } from "../domain/copy.ts";
import type { PublicProfileModel } from "../domain/public-model.ts";
import { MintShelf } from "./mint-shelf.tsx";
import { PlayerCard } from "./player-card.tsx";
import { ProfileShare } from "./profile-share.tsx";
import { ProfilesFrame } from "./profiles-frame.tsx";
import { ScoreTile } from "./score-tile.tsx";

function Section({
  children,
  lead,
  title,
}: {
  readonly children: ReactNode;
  readonly lead: string;
  readonly title: string;
}) {
  return (
    <section className="profile-section">
      <header className="profile-section__head">
        <h2 className="profile-section__title">{title}</h2>
        <p className="profile-section__lead">{lead}</p>
      </header>
      {children}
    </section>
  );
}

function Empty({
  body,
  title,
}: {
  readonly body: string;
  readonly title: string;
}) {
  return (
    <div className="profile-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

// A player's public page: their card, their verified high scores as little cabinets, the milestones they have minted, and a call to play. It
// shows only what the model carries (name, picture, when they joined, verified bests, mints), so it cannot show more than the server chose.
export function PublicProfile({
  model,
  navigation,
  share,
}: {
  readonly model: PublicProfileModel;
  readonly navigation: readonly NavigationItem[];
  readonly share?: ShareConfig | undefined;
}) {
  const { call, mints, scores } = profileCopy.page;
  const latest = model.bests[0];
  return (
    <ProfilesFrame navigation={navigation}>
      <div className="profile-page">
        <header className="profile-page__hero">
          <PlayerCard
            avatar={model.avatar}
            joined={model.joined}
            name={model.name}
            stats={[
              {
                label: profileCopy.card.stats.bests(model.bests.length),
                value: model.bests.length,
              },
              {
                label: profileCopy.card.stats.mints(model.mints.length),
                value: model.mints.length,
              },
            ]}
          />
          <div className="profile-page__intro">
            {latest === undefined ? null : (
              <section className="profile-highlight">
                <p className="profile-highlight__kicker">
                  {profileCopy.page.latest}
                </p>
                <p className="profile-highlight__score">
                  {latest.score.toLocaleString("en-US")}
                </p>
                <p className="profile-highlight__game">{latest.game.title}</p>
                <div className="profile-page__actions">
                  <ArcadeButton
                    ariaLabel={`${scores.beat}: ${latest.game.title}`}
                    href={latest.playHref}
                    tone="pink"
                  >
                    {scores.beat}
                  </ArcadeButton>
                </div>
              </section>
            )}
            <div className="profile-page__actions">
              {share === undefined ? null : (
                <ProfileShare config={share} name={model.name} />
              )}
              <ArcadeButton href={gamesPath} tone="cyan">
                {profileCopy.page.browse}
              </ArcadeButton>
            </div>
          </div>
        </header>
        <Section lead={scores.lead} title={scores.title}>
          {model.bests.length === 0 ? (
            <Empty body={scores.empty.body} title={scores.empty.title} />
          ) : (
            <ul className="score-tiles">
              {model.bests.map((best) => (
                <ScoreTile best={best} key={best.game.id} />
              ))}
            </ul>
          )}
        </Section>
        <Section lead={mints.lead} title={mints.title}>
          {model.mints.length === 0 ? (
            <Empty body={mints.empty.body} title={mints.empty.title} />
          ) : (
            <MintShelf mints={model.mints} />
          )}
        </Section>
        <Section lead={call.body} title={call.title}>
          <div className="profile-page__actions">
            <ArcadeButton href={gamesPath} tone="pink">
              {profileCopy.page.browse}
            </ArcadeButton>
            <ArcadeButton href={profileSetupPath} tone="yellow">
              {profileCopy.page.makeYours}
            </ArcadeButton>
          </div>
        </Section>
      </div>
    </ProfilesFrame>
  );
}

// The page for a name nobody shows: no hint whether it is hidden or free.
export function ProfileNotFound({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <ProfilesFrame navigation={navigation}>
      <div className="profile-missing">
        <ProfileAvatar avatar="ghost" size={112} />
        <h1>{profileCopy.missing.title}</h1>
        <p>{profileCopy.missing.body}</p>
        <div className="profile-page__actions">
          <ArcadeButton href={gamesPath} tone="cyan">
            {profileCopy.page.browse}
          </ArcadeButton>
          <ArcadeButton href={profileSetupPath} tone="yellow">
            {profileCopy.page.makeYours}
          </ArcadeButton>
        </div>
      </div>
    </ProfilesFrame>
  );
}
