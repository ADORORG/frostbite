import type { ReactNode } from "react";

// The top of the page for one thing worth looking at (a collection, a game that cannot be played from here): its cover large, its
// banner or clip behind it, its name as the heading, the facts about it as chips, and a few words. One layout for each, so they read
// as the same kind of page.
export function Showcase({
  backdrop,
  children,
  cover,
  facts,
  status,
  title,
}: {
  // Moving or still art behind everything, dimmed so the words stay readable.
  readonly backdrop?: ReactNode;
  // What is said about it under the facts (a description, an invitation).
  readonly children?: ReactNode;
  // The cover picture, beside the title.
  readonly cover: ReactNode;
  // Small labels about it (chain, supply, version).
  readonly facts?: ReactNode;
  // Where it stands, said truthfully (approved, not yet minted).
  readonly status?: ReactNode;
  readonly title: string;
}) {
  return (
    <header className="showcase">
      {backdrop === undefined ? null : (
        <div className="showcase__backdrop">{backdrop}</div>
      )}
      <div className="showcase__inner">
        <div className="showcase__cover">{cover}</div>
        <div className="showcase__text">
          {status}
          <h1 className="showcase__title">{title}</h1>
          {facts === undefined ? null : (
            <div className="showcase__facts">{facts}</div>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
