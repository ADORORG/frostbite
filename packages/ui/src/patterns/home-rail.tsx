import type { ReactNode } from "react";

// How many cards a rail on the landing page shows; the full list is one link away.
export const homeRailLimit = 6;

// One part of the landing page: a titled band with a link to the full list, a moving background behind it, and the cards (or the honest
// empty state) a feature puts inside. The band does not know what a card is or where the background comes from; the feature supplies
// both, so this stays free of every feature and of the animation package.
export function HomeRail({
  backdrop,
  children,
  compact = false,
  href,
  id,
  linkLabel,
  summary,
  title,
}: {
  // The moving background, which fills the band; decoration only. A compact rail has none.
  readonly backdrop?: ReactNode;
  readonly children?: ReactNode;
  // A feature with nothing to show yet: a small tile (two sit side by side) with a line of words, instead of a whole band.
  readonly compact?: boolean;
  readonly href: string;
  readonly id: string;
  // Left out, there is no link, for a tile with nothing behind it.
  readonly linkLabel?: string;
  readonly summary: string;
  readonly title: string;
}) {
  const headingId = `${id}-title`;
  if (compact)
    return (
      <section
        aria-labelledby={headingId}
        className="home-rail home-rail--compact"
        id={id}
      >
        <h2 id={headingId}>{title}</h2>
        <p>{summary}</p>
        {linkLabel === undefined ? null : (
          <a className="home-rail__link" href={href}>
            {linkLabel}
          </a>
        )}
      </section>
    );
  return (
    <section aria-labelledby={headingId} className="home-rail" id={id}>
      {backdrop === undefined ? null : (
        <div aria-hidden="true" className="home-rail__backdrop">
          {backdrop}
        </div>
      )}
      <div className="home-rail__body">
        <header className="home-rail__head">
          <div>
            <h2 id={headingId}>{title}</h2>
            <p>{summary}</p>
          </div>
          {linkLabel === undefined ? null : (
            <a className="home-rail__link" href={href}>
              {linkLabel}
            </a>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}
