interface ArcadeSelectProps<Value extends string> {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly {
    readonly label: string;
    readonly value: Value;
  }[];
  readonly value: Value;
}

// A labelled native select. The generic keeps the value type exact, so callers get their own union
// back instead of `string`.
export function ArcadeSelect<Value extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: ArcadeSelectProps<Value>) {
  return (
    <label className="arcade-field">
      <span>{label}</span>
      <select
        disabled={disabled}
        onChange={(event) => {
          const chosen = options.find(
            (option) => option.value === event.target.value,
          );
          if (chosen !== undefined) onChange(chosen.value);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
