import { vi } from "vitest";

// A page whose main pointer is a finger (`true`) or a mouse (`false`), for a game's drawing run on its own in Node, where there is no window
// to ask: it answers only the question "(pointer: coarse)". Take it away with `vi.unstubAllGlobals()` after each test.
export function stubPointer(coarse: boolean): void {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
    }),
  });
}
