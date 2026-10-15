import { afterEach, describe, expect, it, vi } from "vitest";

import {
  abortableSleep,
  createBrowserServices,
} from "../../src/client/browser-services.ts";
import { defaultUploadClientPolicy } from "../../src/client/client-policy.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("abortable sleep", () => {
  it("resolves after the delay", async () => {
    vi.useFakeTimers();
    const slept = vi.fn();
    void abortableSleep(100, new AbortController().signal).then(slept);
    await vi.advanceTimersByTimeAsync(99);
    expect(slept).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(slept).toHaveBeenCalledOnce();
  });

  it("rejects with the abort reason as soon as the signal aborts, and stops the timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = abortableSleep(10_000, controller.signal);
    controller.abort(new Error("stop"));
    await expect(pending).rejects.toThrow("stop");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects immediately when already aborted, without scheduling anything", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort(new Error("already"));
    await expect(abortableSleep(10, controller.signal)).rejects.toThrow(
      "already",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("browser services", () => {
  it("provides valid idempotency keys that differ per call", () => {
    const { createIdempotencyKey } = createBrowserServices();
    const first = createIdempotencyKey();
    expect(first).toMatch(/^[A-Za-z0-9._~-]{16,128}$/);
    expect(createIdempotencyKey()).not.toBe(first);
  });

  it("uses the default policy and the real clock, and accepts overrides", () => {
    const services = createBrowserServices();
    expect(services.policy).toEqual(defaultUploadClientPolicy);
    expect(Math.abs(services.now() - Date.now())).toBeLessThan(1_000);
    const policy = { ...defaultUploadClientPolicy, pollIntervalMs: 7 };
    expect(createBrowserServices({ policy }).policy).toBe(policy);
  });

  it("gives the transfer the policy's stall limit, so a send that goes silent is given up on", async () => {
    vi.useFakeTimers();
    try {
      const transfer = createBrowserServices({
        policy: { ...defaultUploadClientPolicy, transferStallMs: 1_000 },
      }).transfer;
      class Silent {
        onabort: (() => void) | null = null;
        onerror = null;
        onload = null;
        status = 0;
        upload = { onprogress: null };
        abort() {
          this.onabort?.();
        }
        open() {}
        send() {}
        setRequestHeader() {}
      }
      const original = globalThis.XMLHttpRequest;
      Object.assign(globalThis, { XMLHttpRequest: Silent });
      const sent = transfer
        .upload({
          body: new Blob(["x"]),
          headers: {},
          onProgress: () => undefined,
          signal: new AbortController().signal,
          url: "https://storage.example.test/up",
        })
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1_000);
      Object.assign(globalThis, { XMLHttpRequest: original });
      expect(await sent).toMatchObject({ failure: "stalled" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends same-origin requests with credentials through the global fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ assets: [], truncated: false }), {
        status: 200,
      }),
    );
    await createBrowserServices().api.listAssets();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/uploads/assets",
      expect.objectContaining({ credentials: "same-origin", method: "GET" }),
    );
  });
});
