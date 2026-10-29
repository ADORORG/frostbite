// A scene chosen at random, skipping the ones already `taken` so neighbouring sections do not repeat. When every one is taken, any may
// repeat. `random` is injected so a test can choose.
export function pickRandom(
  count: number,
  taken: readonly number[],
  random: () => number = Math.random,
): number {
  const free = Array.from({ length: count }, (_, at) => at).filter(
    (at) => !taken.includes(at),
  );
  const from =
    free.length > 0 ? free : Array.from({ length: count }, (_, at) => at);
  return from[Math.floor(random() * from.length)] ?? 0;
}

// A scene chosen from an id, the same every time: a card looks the same on every visit. The hash mixes its bits at the end (a multiply and a shift), so ids that
// differ in a letter do not all land on one scene.
export function pickStable(id: string, count: number): number {
  let hash = 2_166_136_261;
  for (let at = 0; at < id.length; at += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(at), 16_777_619);
  }
  hash = Math.imul(hash, 2_246_822_519);
  hash ^= hash >>> 13;
  return (hash >>> 0) % count;
}
