// One switch of a row of filters: its words, its count, and whether it is pressed. The filter tabs (one on at a time) and the toggle tabs
// (any number on) draw it the same way and differ only in what pressing it means, so the markup, and the class names the stylesheet
// knows it by, live here once.
export function FilterChip({
  count,
  label,
  onPress,
  pressed,
}: {
  readonly count: number;
  readonly label: string;
  readonly onPress: () => void;
  readonly pressed: boolean;
}) {
  return (
    <button
      aria-pressed={pressed}
      className="arcade-filter-tabs__option"
      onClick={onPress}
      type="button"
    >
      {label}
      <span className="arcade-filter-tabs__count">{count}</span>
    </button>
  );
}
