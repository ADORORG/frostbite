// A small deterministic picture for any string, so an address always looks the same and two addresses almost never
// do. Nothing here is secret or a security property: it only helps a person recognise their own wallet at a glance.

const SIZE = 5;
const HALF = 3;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HUES = 360;

// 32-bit FNV-1a over the UTF-16 code units, started from `salt` so one text gives independent numbers.
export function fnv1a(text: string, salt: number): number {
  let hash = (FNV_OFFSET ^ salt) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash;
}

export interface AvatarPattern {
  readonly cells: readonly (readonly boolean[])[];
  readonly hue: number;
}

// A 5x5 grid mirrored left to right (the left three columns come from 15 bits of the hash). The middle cell is
// always filled, so no text yields an empty picture.
export function avatarPattern(seed: string): AvatarPattern {
  const bits = fnv1a(seed, 0);
  const cells = Array.from({ length: SIZE }, (_, row) => {
    const left = Array.from(
      { length: HALF },
      (__, column) => ((bits >>> (row * HALF + column)) & 1) === 1,
    );
    return [...left, left[1] ?? false, left[0] ?? false];
  });
  const middleRow = cells[HALF - 1];
  if (middleRow !== undefined) middleRow[HALF - 1] = true;
  return { cells, hue: fnv1a(seed, 1) % HUES };
}
