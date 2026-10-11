"use client";

import { useState } from "react";

type ArcadeFileDropProps = {
  readonly accept: string;
  readonly disabled?: boolean;
  readonly hint: string;
  readonly label: string;
} & (
  | { readonly onFile: (file: File) => void; readonly onFiles?: never }
  // Takes every file chosen or dropped, in the order given, for a page that handles many at once.
  | { readonly onFile?: never; readonly onFiles: (files: File[]) => void }
);

// A file picker that also accepts dropped files. The native input stays the real control, so it is
// keyboard- and screen-reader-operable; dropping is an enhancement, not the only way in.
export function ArcadeFileDrop({
  accept,
  disabled = false,
  hint,
  label,
  onFile,
  onFiles,
}: ArcadeFileDropProps) {
  const [dragging, setDragging] = useState(false);
  const deliver = (chosen: File[]) => {
    if (onFiles !== undefined) {
      if (chosen.length > 0) onFiles(chosen);
      return;
    }
    const [first] = chosen;
    if (first !== undefined) onFile(first);
  };
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
        if (!disabled) deliver(Array.from(event.dataTransfer.files));
      }}
    >
      <span className="arcade-file-drop__label">{label}</span>
      <span className="arcade-file-drop__hint">{hint}</span>
      <input
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          // The files are copied first: clearing the value lets the same file be chosen again after a
          // failure, and empties the list.
          const chosen = Array.from(event.target.files ?? []);
          event.target.value = "";
          deliver(chosen);
        }}
        multiple={onFiles !== undefined}
        type="file"
      />
    </label>
  );
}
