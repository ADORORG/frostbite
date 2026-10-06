import { describe, expect, it } from "vitest";

import { freePort, waitFor } from "../src/inngest-runtime.ts";

describe("waitFor", () => {
  it("returns the first defined value, polling until it appears", async () => {
    let reads = 0;
    expect(
      await waitFor(
        () => (++reads === 3 ? "ready" : undefined),
        2_000,
        "a value",
      ),
    ).toBe("ready");
    expect(reads).toBe(3);
  });

  it("supports asynchronous readers and falsy-but-defined values", async () => {
    expect(await waitFor(async () => 0, 1_000, "zero")).toBe(0);
  });

  it("fails with the label once the timeout passes", async () => {
    await expect(waitFor(() => undefined, 300, "never")).rejects.toThrow(
      "Timed out waiting for never",
    );
  });
});

describe("freePort", () => {
  it("returns a bindable loopback port", async () => {
    const first = await freePort();
    expect(first).toBeGreaterThan(1_023);
    expect(Number.isInteger(first)).toBe(true);
  });
});
