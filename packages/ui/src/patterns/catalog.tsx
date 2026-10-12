import type { ReactNode } from "react";

// A catalog laid out as a wall of previews rather than a grid of cards: a ticker that moves, then one wide entry
// per item with its preview first. The words stay with the feature; the layout and its movement live here once.

// A line of words that scrolls past. It repeats what the page already says, so it is hidden from assistive
// technology and stops when the person asks for less motion.
export function ArcadeTicker({ items }: { readonly items: readonly string[] }) {
  return (
    <div aria-hidden="true" className="arcade-ticker">
      <div className="arcade-ticker__track">
        {[...items, ...items].map((item, index) => (
          // The same words twice make the loop seamless, so a word is not unique by itself.
          <span key={`${item}-${String(index)}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export function ArcadeCatalog({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <ul aria-label={label} className="arcade-catalog">
      {children}
    </ul>
  );
}

export function ArcadeCatalogEntry({
  actions,
  facts,
  href,
  position,
  preview,
  summary,
  title,
}: {
  readonly actions: ReactNode;
  // Small labels about the item (state, network, how many milestones).
  readonly facts: ReactNode;
  // Where the preview leads. The picture is a convenience: the action in `actions` is the named way in.
  readonly href: string;
  // 1-based place in the list, shown as a number like a score table.
  readonly position: number;
  readonly preview: ReactNode;
  readonly summary: string;
  readonly title: string;
}) {
  return (
    <li className="arcade-catalog__item">
      <article aria-label={title} className="arcade-catalog__entry">
        <a
          aria-hidden="true"
          className="arcade-catalog__preview"
          href={href}
          tabIndex={-1}
        >
          {preview}
        </a>
        <div className="arcade-catalog__body">
          <p aria-hidden="true" className="arcade-catalog__rank">
            {String(position).padStart(2, "0")}
          </p>
          <h3>{title}</h3>
          <p className="arcade-catalog__summary">{summary}</p>
          <div className="arcade-catalog__facts">{facts}</div>
          <div className="arcade-catalog__actions">{actions}</div>
        </div>
      </article>
    </li>
  );
}
