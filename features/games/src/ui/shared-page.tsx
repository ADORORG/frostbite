import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { ArcadeButton, ArcadePanel } from "@repo/ui/arcade";

import { shareCopy } from "../domain/share-copy.ts";
import type { SharedModel } from "../domain/shared-model.ts";
import { GamesFrame } from "./games-frame.tsx";
import { MintedArt } from "./minted-art.tsx";
import {
  SharedCall,
  SharedChips,
  SharedGameLine,
  SharedHero,
  verificationChip,
} from "./shared-parts.tsx";

function MilestoneBody({
  model,
}: {
  readonly model: Extract<SharedModel, { kind: "milestone" }>;
}) {
  const chips = [
    verificationChip(model.verification),
    ...(model.mint === null
      ? []
      : [
          {
            label: shareCopy.page.minted(model.mint.day),
            tone: "good" as const,
          },
        ]),
  ];
  return (
    <>
      <SharedHero
        art={
          <div className="shared-frame">
            <MintedArt
              claimId={model.title}
              cover={model.game.cover?.image ?? null}
              name={model.title}
              {...(model.mint === null ? {} : { src: model.mint.picture })}
            />
            {model.mint === null ? null : (
              <span className="shared-stamp">{shareCopy.page.mintedBadge}</span>
            )}
          </div>
        }
        cover={model.game.cover}
        kicker={shareCopy.page.milestoneKicker}
        tone="milestone"
      >
        <h1 className="shared-title">{model.title}</h1>
        <SharedGameLine game={model.game} />
        <SharedChips items={chips} />
      </SharedHero>
      <section className="shared-facts">
        <div className="shared-fact">
          <h2>{shareCopy.page.criteria}</h2>
          <p>{model.criteria}</p>
        </div>
        <div className="shared-fact">
          <h2>{shareCopy.page.description}</h2>
          <p>{model.description}</p>
        </div>
        {model.mintCount === null ? null : (
          <div className="shared-stat">
            <strong>{model.mintCount.toLocaleString("en-US")}</strong>
            <span>{shareCopy.page.mintCountLabel(model.mintCount)}</span>
          </div>
        )}
      </section>
      <SharedCall
        body={shareCopy.page.milestoneCta.body}
        primary={{
          href: model.game.playHref,
          label: shareCopy.play(model.game.title),
        }}
        title={shareCopy.page.milestoneCta.title}
      />
    </>
  );
}

function ScoreBody({
  model,
}: {
  readonly model: Extract<SharedModel, { kind: "score" }>;
}) {
  return (
    <>
      <SharedHero
        cover={model.game.cover}
        kicker={shareCopy.page.scoreKicker}
        tone="score"
      >
        <p
          aria-label={`${model.score} ${shareCopy.page.scoreLabel}`}
          className="shared-score"
        >
          {model.score}
        </p>
        <SharedGameLine game={model.game} />
        <SharedChips items={[verificationChip(model.verification)]} />
      </SharedHero>
      <SharedCall
        body={shareCopy.page.scoreCta.body}
        primary={{
          href: model.game.playHref,
          label: shareCopy.play(model.game.title),
        }}
        title={shareCopy.page.scoreCta.title}
      />
    </>
  );
}

function ShelfBody({
  model,
}: {
  readonly model: Extract<SharedModel, { kind: "milestones" }>;
}) {
  return (
    <>
      <SharedHero cover={null} kicker={shareCopy.page.shelfKicker} tone="shelf">
        <h1 className="shared-title">
          {shareCopy.page.shelfTitle(
            model.pieces.length + model.more,
            model.games,
          )}
        </h1>
      </SharedHero>
      {model.pieces.length === 0 ? null : (
        <ul className="shared-shelf">
          {model.pieces.map((piece) => (
            <li className="shared-piece" key={piece.claimId}>
              <span className="shared-piece__art">
                <MintedArt
                  claimId={piece.claimId}
                  cover={null}
                  name={piece.title}
                  src={piece.picture}
                />
              </span>
              <strong>{piece.title}</strong>
              <small>
                {piece.game} · {piece.day}
              </small>
            </li>
          ))}
          {model.more === 0 ? null : (
            <li className="shared-piece shared-piece--more">
              <strong>{shareCopy.page.moreOnShelf(model.more)}</strong>
            </li>
          )}
        </ul>
      )}
      <SharedCall
        body={shareCopy.page.shelfCta.body}
        primary={{
          href: model.browseHref,
          label: shareCopy.page.shelfCta.button,
        }}
        secondary={false}
        title={shareCopy.page.shelfCta.title}
      />
    </>
  );
}

// The page a shared link opens: a trophy room, with what was earned shown big and the game around it, how it is known, how it is earned,
// and a way to play. It carries nothing about who shared it.
export function SharedBody({ model }: { readonly model: SharedModel }) {
  return (
    <article className="shared">
      {model.kind === "milestone" ? (
        <MilestoneBody model={model} />
      ) : model.kind === "score" ? (
        <ScoreBody model={model} />
      ) : (
        <ShelfBody model={model} />
      )}
    </article>
  );
}

export function SharedPage({
  model,
  navigation,
}: {
  readonly model: SharedModel;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation} variant="wall">
      <SharedBody model={model} />
    </GamesFrame>
  );
}

// A link that is ended or never was. It says no more than that.
export function SharedNotFound({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation}>
      <ArcadePanel title={shareCopy.notFoundTitle}>
        <p>{shareCopy.notFoundBody}</p>
        <ArcadeButton href="/games" tone="cyan">
          {shareCopy.browse}
        </ArcadeButton>
      </ArcadePanel>
    </GamesFrame>
  );
}
