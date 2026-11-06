import { FilterChip } from "./filter-chip.tsx";

export interface FilterOption<Value extends string> {
  readonly count: number;
  readonly label: string;
  readonly value: Value;
}

// A row of filters, one of which is on. They are buttons that report a choice (not links), so the
// current one is announced with `aria-pressed` and each carries its count in its name.
export function ArcadeFilterTabs<Value extends string>({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly FilterOption<Value>[];
  readonly value: Value;
}) {
  return (
    <div aria-label={label} className="arcade-filter-tabs" role="group">
      {options.map((option) => (
        <FilterChip
          count={option.count}
          key={option.value}
          label={option.label}
          onPress={() => onChange(option.value)}
          pressed={option.value === value}
        />
      ))}
    </div>
  );
}
