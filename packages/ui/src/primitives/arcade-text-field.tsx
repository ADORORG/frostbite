import { useId } from "react";

interface ArcadeTextFieldProps {
  readonly disabled?: boolean;
  // Shown under the control when there is nothing wrong. Linked to it for assistive technology.
  readonly hint?: string;
  // What is wrong, in plain words. Present means the field is marked invalid.
  readonly error?: string | null;
  readonly label: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly type?: "number" | "text";
  readonly value: string;
}

// A labelled text, number, or multi-line field. The value is always a string and the caller parses
// it, so what the person typed is never rewritten under them. The hint and the error are linked with
// `aria-describedby`, and an error also sets `aria-invalid`.
export function ArcadeTextField({
  disabled = false,
  error = null,
  hint,
  label,
  maxLength,
  multiline = false,
  onChange,
  required = false,
  type = "text",
  value,
}: ArcadeTextFieldProps) {
  const noteId = useId();
  const note = error ?? hint;
  const common = {
    "aria-describedby": note === undefined ? undefined : noteId,
    "aria-invalid": error === null ? undefined : true,
    disabled,
    maxLength,
    required,
    value,
  } as const;
  return (
    <label className="arcade-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          {...common}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
        />
      ) : (
        <input
          {...common}
          inputMode={type === "number" ? "numeric" : undefined}
          onChange={(event) => onChange(event.target.value)}
          type={type}
        />
      )}
      {note === undefined ? null : (
        <span
          className={
            error === null
              ? "arcade-field__note"
              : "arcade-field__note arcade-field__note--error"
          }
          id={noteId}
        >
          {error === null ? note : `Problem: ${error}`}
        </span>
      )}
    </label>
  );
}
