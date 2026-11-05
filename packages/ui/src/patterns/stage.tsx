import type { ReactNode } from "react";

// The pieces of a page whose main thing is one stage (a game): a slim bar of controls above it, the stage itself taking the rest of
// the screen, and small cards in a row below. The words stay with the feature; the layout lives here once.

export function ArcadeStage({
  bar,
  children,
  exit,
  overlay,
  theatre = false,
}: {
  // The controls above the stage; they stay at the top of the screen while the stage is in view.
  readonly bar: ReactNode;
  // The stage itself (a frame).
  readonly children: ReactNode;
  // A way out that takes the bar's place while the stage covers the window (a touch screen: the game gets every pixel, and this is a
  // small chip over its corner).
  readonly exit?: ReactNode;
  // Things drawn over the stage's lower edge (a toast, a prompt).
  readonly overlay?: ReactNode;
  // The stage covers the whole window (the page steps out of its way); see the games' theatre mode.
  readonly theatre?: boolean;
}) {
  return (
    <div className="arcade-stage" data-theatre={theatre ? "true" : undefined}>
      {exit !== undefined && theatre ? (
        <div className="arcade-stage__exit">{exit}</div>
      ) : (
        <div className="arcade-stage__bar">{bar}</div>
      )}
      <div className="arcade-stage__screen">{children}</div>
      {overlay === undefined ? null : (
        <div className="arcade-stage__overlay">{overlay}</div>
      )}
    </div>
  );
}

export function ArcadeInfoRow({ children }: { readonly children: ReactNode }) {
  return <div className="arcade-info-row">{children}</div>;
}

export function ArcadeInfoCard({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <section aria-label={title} className="arcade-info-card">
      <h3 className="arcade-info-card__title">{title}</h3>
      {children}
    </section>
  );
}
