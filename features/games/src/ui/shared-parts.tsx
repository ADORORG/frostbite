import { ArcadeButton } from "@repo/ui/arcade";
import type { ReactNode } from "react";

import { shareCopy } from "../domain/share-copy.ts";
import type { SharedGameInfo } from "../domain/shared-model.ts";
import type { ShareVerification } from "@frostbite/shared/games";

// The big picture-and-words block at the top of a shared page, over the game's own cover, blurred and darkened, so the page feels like the
// game it comes from.
export function SharedHero({
  art,
  children,
  cover,
  kicker,
  tone,
}: {
  readonly art?: ReactNode;
  readonly children: ReactNode;
  readonly cover: SharedGameInfo["cover"];
  readonly kicker: string;
  readonly tone: "milestone" | "score" | "shelf";
}) {
  return (
    <section className="shared-hero" data-tone={tone}>
      {cover === null ? null : (
        <img
          alt=""
          aria-hidden="true"
          className="shared-hero__backdrop"
          src={cover.image}
        />
      )}
      <span aria-hidden="true" className="shared-hero__glow" />
      {art === undefined ? null : <div className="shared-hero__art">{art}</div>}
      <div className="shared-hero__body">
        <p className="shared-kicker">{kicker}</p>
        {children}
      </div>
    </section>
  );
}

// "in Frost Runner", with the game's cover as a small badge.
export function SharedGameLine({ game }: { readonly game: SharedGameInfo }) {
  return (
    <p className="shared-game">
      {game.cover === null ? null : (
        <img alt="" className="shared-game__cover" src={game.cover.image} />
      )}
      <span>{shareCopy.page.inGame}</span>{" "}
      <a href={game.playHref}>{game.title}</a>
    </p>
  );
}

export function SharedChips({
  items,
}: {
  readonly items: readonly {
    readonly label: string;
    readonly tone?: "good" | "plain";
  }[];
}) {
  return (
    <ul className="shared-chips">
      {items.map(({ label, tone = "plain" }) => (
        <li data-tone={tone} key={label}>
          {label}
        </li>
      ))}
    </ul>
  );
}

export const verificationChip = (verification: ShareVerification) => ({
  label: shareCopy.verification[verification],
  tone:
    verification === "replay-verified" ? ("good" as const) : ("plain" as const),
});

// The call to action every shared page ends with: a reason to play, and the way in.
export function SharedCall({
  body,
  primary,
  secondary = true,
  title,
}: {
  readonly body: string;
  readonly primary: { readonly href: string; readonly label: string };
  // Whether to offer the games list as well; not when the main button already goes there.
  readonly secondary?: boolean;
  readonly title: string;
}) {
  return (
    <section className="shared-call">
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="shared-call__buttons">
        <ArcadeButton href={primary.href} tone="yellow">
          {primary.label}
        </ArcadeButton>
        {secondary ? (
          <ArcadeButton href="/games" tone="cyan">
            {shareCopy.browse}
          </ArcadeButton>
        ) : null}
      </div>
    </section>
  );
}
