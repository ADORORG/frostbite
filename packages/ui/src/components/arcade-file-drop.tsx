"use client";

import { useState } from "react";

interface ArcadeFileDropProps {
  readonly accept: string;
  readonly disabled?: boolean;
  readonly hint: string;
  readonly label: string;
  readonly onFile: (file: File) => void;
}

// A file picker that also accepts a dropped file. The native input stays the real control, so it is
// keyboard- and screen-reader-operable; dropping is an enhancement, not the only way in.
export function ArcadeFileDrop({
  accept,
  disabled = false,
  hint,
  label,
  onFile,
}: ArcadeFileDropProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={`arcade-file-drop${dragging ? " arcade-file-drop--active" : ""}${disabled ? " arcade-file-drop--disabled" : ""}`}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (!disabled && file !== undefined) onFile(file);
      }}
    >
      <span className="arcade-file-drop__label">{label}</span>
      <span className="arcade-file-drop__hint">{hint}</span>
      <input
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clearing the value lets the same file be chosen again after a failure.
          event.target.value = "";
          if (file !== undefined) onFile(file);
        }}
        type="file"
      />
    </label>
  );
}
