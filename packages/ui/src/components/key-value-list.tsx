import type { ReactNode } from "react";

export interface KeyValue {
  readonly label: string;
  // An address, hash or id: set in the code face and allowed to break anywhere.
  readonly mono?: boolean;
  // Nothing to say: the row is left out, so a caller can list everything that might apply.
  readonly value: ReactNode | null | undefined;
}

// Facts as label and value pairs: two columns where there is room (the label small and quiet, the value plain), one where there is
// not. A value that is absent leaves no row behind.
export function KeyValueList({
  items,
  label,
}: {
  readonly items: readonly KeyValue[];
  // What the list is, for someone who cannot see its grouping.
  readonly label?: string;
}) {
  const shown = items.filter(
    ({ value }) => value !== null && value !== undefined,
  );
  if (shown.length === 0) return null;
  return (
    <dl aria-label={label} className="kv">
      {shown.map((item) => (
        <div className="kv__row" key={item.label}>
          <dt>{item.label}</dt>
          <dd data-mono={item.mono === true ? "true" : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
