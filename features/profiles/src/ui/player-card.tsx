import { profilePath } from "@frostbite/shared/profiles";
import { ProfileAvatar, avatarAccent } from "@repo/ui/arcade";

import { profileCopy } from "../domain/copy.ts";
import type { StyleWithVars } from "./css-vars.ts";

export interface CardStat {
  readonly label: string;
  readonly value: number;
}

// A profile as a collector's card: the picture in a lit frame, the name big, when they joined, and a few counts. The setup page shows it
// as a live preview and the public page as its hero, so they cannot look unlike each other. With no name yet it shows the placeholder, dimmed.
export function PlayerCard({
  avatar,
  joined,
  name,
  stats = [],
}: {
  readonly avatar: string;
  // "Joined Nov 2026", or none while a card is only a preview.
  readonly joined?: string | null;
  readonly name: string;
  readonly stats?: readonly CardStat[];
}) {
  const style: StyleWithVars = { "--card-accent": avatarAccent(avatar) };
  const empty = name === "";
  return (
    <article className="player-card" style={style}>
      <p className="player-card__ribbon">{profileCopy.card.ribbon}</p>
      <div className="player-card__body">
        <div className="player-card__portrait">
          <ProfileAvatar avatar={avatar} size={144} />
        </div>
        <div className="player-card__text">
          <h2 className="player-card__name" data-empty={empty}>
            {empty ? profileCopy.setup.preview.placeholder : name}
          </h2>
          {empty ? null : (
            <p className="player-card__handle">{profilePath(name)}</p>
          )}
          {joined === undefined || joined === null ? null : (
            <p className="player-card__since">{joined}</p>
          )}
        </div>
      </div>
      {stats.length === 0 ? null : (
        <ul className="player-card__stats">
          {stats.map(({ label, value }) => (
            <li className="player-card__stat" key={label}>
              <strong>{value.toLocaleString("en-US")}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
