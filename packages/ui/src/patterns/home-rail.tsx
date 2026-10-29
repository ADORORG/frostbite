import type { ReactNode } from "react";

// How many cards a rail on the landing page shows; the full list is one link away.
export const homeRailLimit = 6;

// One part of the landing page: a titled band with a link to the full list, a moving background behind it, and the cards (or the honest
// empty state) a feature puts inside. The band does not know what a card is or where the background comes from; the feature supplies
// both, so this stays free of every feature and of the animation package.
export function HomeRail({
  backdrop,
  children,
  href,
  id,
  linkLabel,
  summary,
  title,
}: {
  // The moving background, which fills the band; decoration only.
  readonly backdrop?: ReactNode;
  readonly children: ReactNode;
  readonly href: string;
  readonly id: string;
  readonly linkLabel: string;
  readonly summary: string;
  readonly title: string;
}) {
  const headingId = `${id}-title`;
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
          <a className="home-rail__link" href={href}>
            {linkLabel}
          </a>
        </header>
        {children}
      </div>
    </section>
  );
}
