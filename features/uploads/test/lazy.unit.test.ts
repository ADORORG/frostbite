import { describe, expect, it, vi } from "vitest";

import { memoizeUntilFailure } from "../src/lazy.ts";

describe("memoize until failure", () => {
  it("builds once and hands every caller the same promise", async () => {
    const build = vi.fn(async () => ({ built: true }));
    const get = memoizeUntilFailure(build);
    const first = get();
    expect(get()).toBe(first);
    await expect(first).resolves.toEqual({ built: true });
    await get();
    expect(build).toHaveBeenCalledOnce();
  });

  it("builds nothing until first used", () => {
    const build = vi.fn(async () => 1);
    memoizeUntilFailure(build);
    expect(build).not.toHaveBeenCalled();
  });

  it("forgets a failed build so the next call tries again", async () => {
    const build = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("not yet"))
      .mockResolvedValueOnce("ready");
    const get = memoizeUntilFailure(build);
    await expect(get()).rejects.toThrow("not yet");
    await expect(get()).resolves.toBe("ready");
    await expect(get()).resolves.toBe("ready");
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("treats a build that throws before returning a promise as a failed build", async () => {
    let attempts = 0;
    const get = memoizeUntilFailure((): Promise<number> => {
      attempts += 1;
      if (attempts === 1) throw new Error("sync failure");
      return Promise.resolve(attempts);
    });
    await expect(get()).rejects.toThrow("sync failure");
    await expect(get()).resolves.toBe(2);
  });

  it("shares one in-flight build between concurrent callers", async () => {
    let release: (value: string) => void = () => undefined;
    const build = vi.fn(
      () => new Promise<string>((resolve) => (release = resolve)),
    );
    const get = memoizeUntilFailure(build);
    const [a, b] = [get(), get()];
    await vi.waitFor(() => expect(build).toHaveBeenCalled());
    release("done");
    await expect(Promise.all([a, b])).resolves.toEqual(["done", "done"]);
    expect(build).toHaveBeenCalledOnce();
  });
});
