import type { FilterOption } from "./arcade-filter-tabs.tsx";
import { FilterChip } from "./filter-chip.tsx";

// A row of switches, any number of which are on: kinds of thing to show (any of them), or one yes-or-no filter. The look is the filter
// tabs'; the difference is that each one is on or off by itself, so each says so with `aria-pressed` and a person with a screen reader
// hears "Puzzle, 3, toggle button, pressed". A count of 0 stays visible and pressable: turning on a kind that has nothing says so.
export function ArcadeToggleTabs<Value extends string>({
  label,
  onChange,
  options,
  selected,
}: {
  readonly label: string;
  // The value that was just switched, and whether it is now on.
  readonly onChange: (value: Value, on: boolean) => void;
  readonly options: readonly FilterOption<Value>[];
  readonly selected: readonly Value[];
}) {
  return (
    <div aria-label={label} className="arcade-filter-tabs" role="group">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <FilterChip
            count={option.count}
            key={option.value}
            label={option.label}
            onPress={() => onChange(option.value, !on)}
            pressed={on}
          />
        );
      })}
    </div>
  );
}
