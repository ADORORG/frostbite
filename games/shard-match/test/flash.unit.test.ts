import { afterEach, describe, expect, it, vi } from "vitest";

import { createFlash, flashMs } from "../src/flash.ts";

afterEach(() => vi.useRealTimers());

describe("the flash of what a swap cleared", () => {
  it("clears after its time, and not before", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    createFlash(clear).show();
    vi.advanceTimersByTime(flashMs - 1);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("starts its time again when a newer flash replaces it, so one clear comes, after the last", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    const flash = createFlash(clear);
    flash.show();
    vi.advanceTimersByTime(flashMs - 10);
    flash.show();
    vi.advanceTimersByTime(flashMs - 10);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("does not clear once stopped", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    const flash = createFlash(clear);
    flash.show();
    flash.stop();
    vi.advanceTimersByTime(flashMs * 2);
    expect(clear).not.toHaveBeenCalled();
  });
});
