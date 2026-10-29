import type { SchedulerEnvironment } from "../engine/index.ts";

// The scheduler's clock and frame loop, taken from the window when it is asked for (never at import), so a page rendered on the server
// is safe and a test can supply its own.
export const browserEnvironment: SchedulerEnvironment = {
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  hidden: () => document.hidden,
  requestFrame: (callback) => window.requestAnimationFrame(callback),
};
