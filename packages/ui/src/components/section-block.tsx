import type { ReactNode } from "react";

// A part of a page, set apart by its heading rather than by a box: a small title, a line of what it is for, anything to do about it
// at the end of the heading row (a button, a count), and then the body. Pages built of these read as separate parts without every part
// being a card inside a card.
export function SectionBlock({
  actions,
  children,
  description,
  title,
}: {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description?: string;
  readonly title: string;
}) {
  return (
    <section aria-label={title} className="block">
      <div className="block__head">
        <div>
          <h2 className="block__title">{title}</h2>
          {description === undefined ? null : (
            <p className="block__description">{description}</p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="block__actions">{actions}</div>
        )}
      </div>
      <div className="block__body">{children}</div>
    </section>
  );
}

// A grid that fits as many equal tiles as the width allows, and one column on a narrow screen.
export function TileGrid({ children }: { readonly children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}

// One thing in a grid: what it is, how it stands, and what can be done to it.
export function Tile({
  badge,
  children,
  footer,
  title,
}: {
  readonly badge?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly title: ReactNode;
}) {
  return (
    <article className="tile">
      <header className="tile__head">
        <h3 className="tile__title">{title}</h3>
        {badge}
      </header>
      {children === undefined ? null : (
        <div className="tile__body">{children}</div>
      )}
      {footer === undefined ? null : (
        <footer className="tile__footer">{footer}</footer>
      )}
    </article>
  );
}
