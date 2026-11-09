// Turning what the player presses into one of the rules' sixteen ways. The player steers by the screen: up is the way the camera looks
// across the ground, right is to its right. The rules' way 0 is north (toward the meadow, -z) and the ways go round clockwise, 4 to +x.
export interface Ground {
  readonly x: number;
  readonly z: number;
}

// A push on the screen (right and up, any length) seen from a camera looking `forward` across the ground: one of the sixteen ways, or -1
// for a push too small to mean anything.
export function wayFor(
  push: { readonly x: number; readonly y: number },
  forward: Ground,
): number {
  const length = Math.hypot(push.x, push.y);
  const facing = Math.hypot(forward.x, forward.z);
  if (length < 1e-6 || facing < 1e-6) return -1;
  const fx = forward.x / facing;
  const fz = forward.z / facing;
  // The camera's right on the ground is (-fz, fx).
  const x = (fx * push.y - fz * push.x) / length;
  const z = (fz * push.y + fx * push.x) / length;
  const turn = Math.atan2(x, -z) / (Math.PI * 2);
  return ((Math.round(turn * 16) % 16) + 16) % 16;
}

// The keys held, as a push: each arrow (or WASD) adds its direction; opposite keys cancel.
export interface Held {
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
}

export const pushOf = (
  held: Held,
): { readonly x: number; readonly y: number } => ({
  x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
  y: (held.up ? 1 : 0) - (held.down ? 1 : 0),
});

// Looking north, as the flat map does (north at the top).
export const north: Ground = { x: 0, z: -1 };
