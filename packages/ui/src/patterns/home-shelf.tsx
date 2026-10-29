import type { ReactNode } from "react";

// A slim row on the landing page for things that are many and small (collections): a title with the link to the full list on one line,
// then one short tile for each thing, wrapping only when the width runs out. It has no moving background and no description of its own;
// each tile is the whole link, so the row stays a few lines tall however much there is behind it.
export function HomeShelf({
  children,
  href,
  id,
  linkLabel,
  title,
}: {
  readonly children: ReactNode;
  readonly href: string;
  readonly id: string;
  readonly linkLabel: string;
  readonly title: string;
}) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className="home-shelf" id={id}>
      <header className="home-shelf__head">
        <h2 id={headingId}>{title}</h2>
        <a className="home-rail__link" href={href}>
          {linkLabel}
        </a>
      </header>
      <ul aria-label={title} className="home-shelf__list">
        {children}
      </ul>
    </section>
  );
}

// One tile of the row: a small picture beside a name and one line about it. The tile is a single link named by `label`.
export function ShelfTile({
  href,
  label,
  media,
  meta,
  title,
}: {
  readonly href: string;
  // The link's name for someone who cannot see the tile.
  readonly label: string;
  readonly media: ReactNode;
  readonly meta: string;
  readonly title: string;
}) {
  return (
    <li>
      <a aria-label={label} className="home-shelf__tile" href={href}>
        <span className="home-shelf__media">{media}</span>
        <span className="home-shelf__text">
          <b>{title}</b>
          <small>{meta}</small>
        </span>
      </a>
    </li>
  );
}
