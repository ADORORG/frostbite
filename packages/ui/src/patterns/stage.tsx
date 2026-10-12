import type { ReactNode } from "react";

// The pieces of a page whose main thing is one stage (a game): a single title line, a slim bar of controls that
// stays in view while the stage is on screen, the stage itself, and small cards in a row below. The words stay
// with the feature; the layout lives here once.

export function ArcadeStageHead({
  meta,
  title,
}: {
  // Small facts on the same line as the title (version, network, state).
  readonly meta: ReactNode;
  readonly title: string;
}) {
  return (
    <div className="arcade-stage-head">
      <h2 className="arcade-stage-title">{title}</h2>
      <div className="arcade-stage-meta">{meta}</div>
    </div>
  );
}

export function ArcadeStage({
  bar,
  children,
  overlay,
}: {
  // The controls above the stage; they stay at the top of the screen while the stage is in view.
  readonly bar: ReactNode;
  // The stage itself (a frame).
  readonly children: ReactNode;
  // Things drawn over the stage's lower edge (a toast, a prompt).
  readonly overlay?: ReactNode;
}) {
  return (
    <div className="arcade-stage">
      <div className="arcade-stage__bar">{bar}</div>
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
