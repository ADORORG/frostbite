interface ArcadeProgressProps {
  readonly label: string;
  // 0 to 1.
  readonly value: number;
}

// A determinate progress meter. The percentage is also given as text, so it is not conveyed by the
// bar alone.
export function ArcadeProgress({ label, value }: ArcadeProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="arcade-progress">
      <progress aria-label={label} max={100} value={percent} />
      <span className="arcade-progress__value">{percent}%</span>
    </div>
  );
}
