import type { DrawingPolicy } from "../src/policy.ts";

// Generous bounds for tests; production values come from the game's configuration.
export const policy: DrawingPolicy = {
  maxAttributeLength: 512,
  maxBytes: 4096,
  maxDepth: 8,
  maxElements: 64,
};

export const ns = "http://www.w3.org/2000/svg";
export const wrap = (inner: string, attributes = ` viewBox="0 0 10 10"`) =>
  `<svg xmlns="${ns}"${attributes}>${inner}</svg>`;
