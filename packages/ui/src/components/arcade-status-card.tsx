import type { ReactNode } from "react";

// Where the thing on a card stands, for a glance: `done` is finished, `waiting` is under way, `problem` needs another try, `idle` has not
// begun. The tone is for the eye; the label always says it in words.
export type StatusCardTone = "done" | "idle" | "problem" | "waiting";

// One thing in a list that has a name, a state and at most one thing to do about it: the title with its state said at the top, what is
// worth knowing under it, and the one action (a button) apart at the bottom, so the eye can tell what to read from what to press. Used
// inside a list item, which is where a screen reader hears the list.
export function ArcadeStatusCard({
  action,
  children,
  status,
  title,
}: {
  // The one thing to do about it, if there is one.
  readonly action?: ReactNode;
  readonly children?: ReactNode;
  // Absent where nothing is known about the person's own state of it.
  readonly status?: { readonly label: string; readonly tone: StatusCardTone };
  readonly title: string;
}) {
  return (
    <div className="status-card" data-tone={status?.tone}>
      <div className="status-card__head">
        <strong className="status-card__title">{title}</strong>
        {status === undefined ? null : (
          <span className="status-card__state">{status.label}</span>
        )}
      </div>
      {children === undefined ? null : (
        <div className="status-card__body">{children}</div>
      )}
      {action === undefined ? null : (
        <div className="status-card__action">{action}</div>
      )}
    </div>
  );
}
