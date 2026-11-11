"use client";

import { useId } from "react";

import { profileCopy } from "../domain/copy.ts";

// Whether the page is shown, as a switch with a sentence that says what the choice means right now.
export function VisibilitySwitch({
  onChange,
  value,
}: {
  readonly onChange: (visible: boolean) => void;
  readonly value: boolean;
}) {
  const labelId = useId();
  const noteId = useId();
  const { visibility } = profileCopy.setup;
  return (
    <div className="visibility">
      <p className="visibility__label" id={labelId}>
        {visibility.label}
      </p>
      <button
        aria-checked={value}
        aria-describedby={noteId}
        aria-labelledby={labelId}
        className="visibility__switch"
        onClick={() => onChange(!value)}
        role="switch"
        type="button"
      />
      <p className="visibility__note" id={noteId}>
        {value ? visibility.on : visibility.off} {visibility.neverShown}
      </p>
    </div>
  );
}
