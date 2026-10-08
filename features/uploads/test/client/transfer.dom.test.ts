import { describe, expect, it, vi } from "vitest";

import {
  TransferError,
  createXhrTransfer,
  scriptSettableHeaders,
} from "../../src/client/transfer.ts";

class FakeRequest {
  aborted = false;
  headers: Record<string, string> = {};
  method = "";
  onabort: ((event: ProgressEvent) => void) | null = null;
  onerror: ((event: ProgressEvent) => void) | null = null;
  onload: ((event: ProgressEvent) => void) | null = null;
  sent: Blob | null = null;
  status = 0;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  url = "";
  // Like the real object: aborting a request that was never sent fires no `abort` event.
  abort() {
    this.aborted = true;
    if (this.sent !== null) this.onabort?.(new ProgressEvent("abort"));
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: Blob) {
    this.sent = body;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
}

function setup() {
  const request = new FakeRequest();
  const transfer = createXhrTransfer(() => request);
  const controller = new AbortController();
  const progress = vi.fn();
  const start = () =>
    transfer.upload({
      body: new Blob(["abc"]),
      headers: { "content-length": "3", "content-type": "image/png" },
      onProgress: progress,
      signal: controller.signal,
      url: "https://storage.example.test/up",
    });
  return { controller, progress, request, start };
}

describe("browser object transfer", () => {
  it("PUTs the blob, passes only script-settable headers, and reports progress", async () => {
    const { progress, request, start } = setup();
    const done = start();
    expect([request.method, request.url]).toEqual([
      "PUT",
      "https://storage.example.test/up",
    ]);
    expect(request.headers).toEqual({ "content-type": "image/png" });
    for (const init of [
      { lengthComputable: true, loaded: 1, total: 4 },
      { lengthComputable: false, loaded: 2, total: 4 },
      { lengthComputable: true, loaded: 0, total: 0 },
    ])
      request.upload.onprogress?.(new ProgressEvent("progress", init));
    request.status = 200;
    request.onload?.(new ProgressEvent("load"));
    await expect(done).resolves.toBeUndefined();
    expect(progress.mock.calls).toEqual([[0.25]]);
    expect(request.sent).toBeInstanceOf(Blob);
  });

  it.each([[403], [500], [199], [300]])(
    "fails with a rejected transfer on status %s",
    async (status) => {
      const { request, start } = setup();
      const done = start();
      request.status = status;
      request.onload?.(new ProgressEvent("load"));
      await expect(done).rejects.toMatchObject({
        failure: "rejected",
        name: "TransferError",
        status,
      });
    },
  );

  it("accepts the whole 2xx range", async () => {
    for (const status of [200, 204, 299]) {
      const { request, start } = setup();
      const done = start();
      request.status = status;
      request.onload?.(new ProgressEvent("load"));
      await expect(done).resolves.toBeUndefined();
    }
  });

  it("fails with a network error", async () => {
    const { request, start } = setup();
    const done = start();
    request.onerror?.(new ProgressEvent("error"));
    await expect(done).rejects.toMatchObject({
      failure: "network",
      status: null,
    });
  });

  it("aborts the request when the signal fires, and only then", async () => {
    const { controller, request, start } = setup();
    const done = start();
    expect(request.aborted).toBe(false);
    controller.abort();
    await expect(done).rejects.toMatchObject({ failure: "aborted" });
    expect(request.aborted).toBe(true);
  });

  it("settles as aborted, without sending, when the signal is already aborted", async () => {
    const { controller, request, start } = setup();
    controller.abort();
    const never = Symbol("unsettled");
    const outcome = await Promise.race([
      start().then(
        () => "resolved",
        (error: Error) => error,
      ),
      new Promise((resolve) => setTimeout(() => resolve(never), 50)),
    ]);
    expect(outcome).toBeInstanceOf(TransferError);
    expect(outcome).toMatchObject({ failure: "aborted" });
    expect(request.sent).toBeNull();
  });

  it("stops listening for aborts once settled", async () => {
    const { controller, request, start } = setup();
    const done = start();
    request.status = 200;
    request.onload?.(new ProgressEvent("load"));
    await done;
    controller.abort();
    expect(request.aborted).toBe(false);
  });
});

describe("script-settable headers", () => {
  it("drops browser-managed headers case-insensitively and keeps the rest", () => {
    expect(
      scriptSettableHeaders({
        "Content-Length": "3",
        HOST: "x",
        "content-type": "image/png",
        "x-amz-meta": "1",
      }),
    ).toEqual({ "content-type": "image/png", "x-amz-meta": "1" });
  });
});
