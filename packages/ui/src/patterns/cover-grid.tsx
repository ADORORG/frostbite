import type { ReactNode } from "react";

// A wall of covers: as many equal cards as the width allows, one column on a phone, and the first card (when asked) twice as wide, so
// the page opens on one thing worth looking at. The words stay with the feature; the layout lives here once, for games and for
// collections.
export function CoverGrid({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <ul aria-label={label} className="cover-grid">
      {children}
    </ul>
  );
}

// One cover in the wall. The whole card is one link (the picture, the name and the call to action lead to the same place), named by
// `label`, so a person using a keyboard or a screen reader meets it once.
export function CoverCard({
  badges,
  cta,
  featured = false,
  heat,
  hot,
  href,
  label,
  media,
  rank,
  ratio = "wide",
  summary,
  title,
}: {
  // Small labels about the item (state, network, how many items).
  readonly badges: ReactNode;
  // What the card invites (Play now, View collection); drawn, not a second link.
  readonly cta: string;
  // The first card of a wall, drawn larger.
  readonly featured?: boolean;
  // How hot the item is, drawn in the body above the call to action (a `HeatMeter`); none for an item that is not ranked.
  readonly heat?: ReactNode;
  // The sticker of a hot item (a `HotSticker`), drawn on the picture's corner; its presence also lights the card's rim.
  readonly hot?: ReactNode;
  readonly href: string;
  // The link's name for someone who cannot see the card.
  readonly label: string;
  readonly media: ReactNode;
  // 1-based place in the wall, drawn on the picture as a number like a score table; none for a wall that has no order.
  readonly rank?: number;
  // The shape of the picture: wide for a game, square for a collection.
  readonly ratio?: "square" | "wide";
  readonly summary: string;
  readonly title: string;
}) {
  return (
    <li
      className="cover-card"
      data-featured={featured ? "true" : undefined}
      data-hot={hot === undefined ? undefined : "true"}
      data-ratio={ratio}
    >
      <a aria-label={label} className="cover-card__link" href={href}>
        <div className="cover-card__media">
          {media}
          {hot}
          {rank === undefined ? null : (
            <span aria-hidden="true" className="cover-card__rank">
              {String(rank).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="cover-card__body">
          <div className="cover-card__badges">{badges}</div>
          <h3 className="cover-card__title">{title}</h3>
          {summary === "" ? null : (
            <p className="cover-card__summary">{summary}</p>
          )}
          {heat}
          <span aria-hidden="true" className="cover-card__cta">
            {cta}
          </span>
        </div>
      </a>
    </li>
  );
}
