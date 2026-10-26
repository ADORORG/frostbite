export type StatusTone = "attention" | "neutral" | "ready" | "unavailable";

interface StatusLampProps {
  // A small lamp for a bar or a corner, rather than a line of the page.
  readonly compact?: boolean;
  // More than the label has room for. Shown on hover and keyboard focus, and always read out with the label.
  readonly detail?: string;
  readonly label: string;
  // The label is a sentence to read, not a state's name: shown in the body type, not as pixel capitals.
  readonly plain?: boolean;
  readonly tone?: StatusTone;
}

export function StatusLamp({
  compact = false,
  detail,
  label,
  plain = false,
  tone = "attention",
}: StatusLampProps) {
  return (
    <p
      className={`status-lamp status-lamp--${tone}`}
      data-compact={compact ? "true" : undefined}
      data-plain={plain ? "true" : undefined}
      role="status"
      tabIndex={detail === undefined ? undefined : 0}
    >
      <span className="status-lamp__light" aria-hidden="true" />
      {label}
      {detail === undefined ? null : (
        <span className="status-lamp__detail">{detail}</span>
      )}
    </p>
  );
}
