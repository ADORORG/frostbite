import type { ReactNode } from "react";

// What a list says when there is nothing in it yet: a plain title, one sentence on what goes here,
// and the one thing to do about it.
export function ArcadeEmptyState({
  action,
  children,
  title,
}: {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <div className="arcade-empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action === undefined ? null : (
        <div className="arcade-actions">{action}</div>
      )}
    </div>
  );
}
