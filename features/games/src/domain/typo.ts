// Forgiving a slipped letter in a word being searched for. Only for words long enough that one slip is still clearly that word: "sand"
// must not find "snow", so a word under four letters is never forgiven.
const forgiveFrom = 4;
const longWord = 8;

const slipsAllowed = (length: number): number =>
  length < forgiveFrom ? 0 : length < longWord ? 1 : 2;

// Optimal string alignment distance: the fewest insertions, deletions, substitutions and swaps of two neighbouring letters to turn one
// word into the other. A swap counts once because it is the commonest slip ("snwoball").
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      row === 0 ? col : col === 0 ? row : 0,
    ),
  );
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      let best = Math.min(
        (grid[row - 1]?.[col] ?? 0) + 1,
        (grid[row]?.[col - 1] ?? 0) + 1,
        (grid[row - 1]?.[col - 1] ?? 0) + cost,
      );
      if (
        row > 1 &&
        col > 1 &&
        a[row - 1] === b[col - 2] &&
        a[row - 2] === b[col - 1]
      )
        best = Math.min(best, (grid[row - 2]?.[col - 2] ?? 0) + 1);
      const line = grid[row];
      if (line !== undefined) line[col] = best;
    }
  }
  return grid[a.length]?.[b.length] ?? 0;
}

// Whether `typed` is `found` with a slip or two, or the start of it with a slip or two (a person is partway through typing a word).
export function withinTypo(typed: string, found: string): boolean {
  const allowed = slipsAllowed(typed.length);
  if (allowed === 0) return false;
  return (
    editDistance(typed, found) <= allowed ||
    editDistance(typed, found.slice(0, typed.length)) <= allowed
  );
}
