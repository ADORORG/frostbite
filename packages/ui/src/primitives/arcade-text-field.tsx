import { useId, type Ref } from "react";

interface ArcadeTextFieldProps {
  // What the browser may fill in or offer (`email`, `one-time-code`); see the HTML autocomplete values.
  readonly autoComplete?: string;
  readonly disabled?: boolean;
  // Shown under the control when there is nothing wrong. Linked to it for assistive technology.
  readonly hint?: string;
  // What is wrong, in plain words. Present means the field is marked invalid.
  readonly error?: string | null;
  // The on-screen keyboard to offer. A number field asks for the numeric one unless this says otherwise.
  readonly inputMode?: "email" | "numeric" | "text";
  // The control itself, for a page that moves the focus to it (a search box answering a shortcut key).
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label: string;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly type?: "email" | "number" | "search" | "text";
  readonly value: string;
}

// A labelled text, number, or multi-line field. The value is always a string and the caller parses
// it, so what the person typed is never rewritten under them. The hint and the error are linked with
// `aria-describedby`, and an error also sets `aria-invalid`.
export function ArcadeTextField({
  autoComplete,
  disabled = false,
  error = null,
  hint,
  inputMode,
  inputRef,
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
    autoComplete,
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
          inputMode={inputMode ?? (type === "number" ? "numeric" : undefined)}
          onChange={(event) => onChange(event.target.value)}
          ref={inputRef}
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
