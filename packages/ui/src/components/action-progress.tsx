import type { ReactNode } from "react";

export type ProgressState = "active" | "done" | "failed" | "pending";

export interface ProgressStep {
  readonly detail?: string;
  readonly label: string;
  readonly state: ProgressState;
}

// What a step's state is, said in text as well as drawn, so it is never carried by colour or shape alone.
const stateWord: Readonly<Record<ProgressState, string>> = {
  active: "in progress",
  done: "done",
  failed: "failed",
  pending: "not yet",
};

// A ring that turns while something is being done. Still (a ring with a gap) when the person asks for less motion.
export function Spinner() {
  return <span aria-hidden="true" className="spinner" />;
}

// The one way anything that takes a while says so: what is being done, an honest line about it, and, where the work has stages the
// platform really reports, those stages with where each stands. It is a status region, so it is read out when it appears and as it
// changes. Used for starting a step, and for a step's life from built to indexed.
export function ActionProgress({
  children,
  detail,
  steps,
  title,
  working = true,
}: {
  readonly children?: ReactNode;
  readonly detail?: string;
  readonly steps?: readonly ProgressStep[];
  readonly title: string;
  // Whether something is being done now (the ring turns). A finished or failed run shows its steps without it.
  readonly working?: boolean;
}) {
  return (
    <div aria-live="polite" className="action-progress" role="status">
      <div className="action-progress__head">
        {working ? <Spinner /> : null}
        <div>
          <strong className="action-progress__title">{title}</strong>
          {detail === undefined ? null : (
            <p className="action-progress__detail">{detail}</p>
          )}
        </div>
      </div>
      {steps === undefined ? null : (
        <ol className="progress-steps">
          {steps.map((step, index) => (
            <li data-state={step.state} key={step.label}>
              <span aria-hidden="true" className="progress-steps__mark">
                {step.state === "done"
                  ? "✓"
                  : step.state === "failed"
                    ? "✕"
                    : index + 1}
              </span>
              <span className="progress-steps__text">
                {step.label}
                <span className="progress-steps__state">{` (${stateWord[step.state]})`}</span>
                {step.detail === undefined ? null : (
                  <small>{step.detail}</small>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {children}
    </div>
  );
}
