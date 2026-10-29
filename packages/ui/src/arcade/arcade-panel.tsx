import type { ReactNode } from "react";

interface ArcadePanelProps {
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly title: string;
}

export function ArcadePanel({ children, eyebrow, title }: ArcadePanelProps) {
  return (
    <article className="arcade-panel">
      {eyebrow === undefined ? null : (
        <p className="arcade-eyebrow">{eyebrow}</p>
      )}
      <h2>{title}</h2>
      {children}
    </article>
  );
}
