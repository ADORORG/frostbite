import { createServer, type Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createXhrTransfer } from "../../src/client/transfer.ts";

// The real XMLHttpRequest (jsdom's implementation) against a real local HTTP server, so the parts the
// fake-based tests cannot prove are proven: the real object satisfies the transfer's request
// contract, sends the bytes and headers, and reports progress, refusals, and aborts.
const received: { body: string; contentType: string | undefined }[] = [];
let respondWith = 200;
let holdResponse = false;
let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type");
    response.setHeader("access-control-allow-methods", "PUT");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        body: Buffer.concat(chunks).toString(),
        contentType: request.headers["content-type"],
      });
      if (!holdResponse) response.writeHead(respondWith).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The test server did not bind to a TCP port.");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const upload = (
  overrides: {
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
    url?: string;
  } = {},
) =>
  createXhrTransfer().upload({
    body: new Blob(["pixels"]),
    headers: { "content-length": "6", "content-type": "image/png" },
    onProgress: overrides.onProgress ?? vi.fn(),
    signal: overrides.signal ?? new AbortController().signal,
    url: overrides.url ?? `${origin}/object`,
  });

describe("browser object transfer over a real XMLHttpRequest", () => {
  it("sends the bytes with the script-settable headers and resolves on success", async () => {
    received.length = 0;
    respondWith = 200;
    const onProgress = vi.fn();
    await expect(upload({ onProgress })).resolves.toBeUndefined();
    expect(received).toEqual([{ body: "pixels", contentType: "image/png" }]);
    // A real upload reports fractions, ending at the whole body.
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it("rejects with the status when storage refuses the object", async () => {
    respondWith = 403;
    await expect(upload()).rejects.toMatchObject({
      failure: "rejected",
      status: 403,
    });
  });

  it("rejects as a network failure when nothing is listening", async () => {
    await expect(
      upload({ url: "http://127.0.0.1:1/object" }),
    ).rejects.toMatchObject({ failure: "network", status: null });
  });

  it("aborts a request that is in flight", async () => {
    holdResponse = true;
    received.length = 0;
    const controller = new AbortController();
    const pending = upload({ signal: controller.signal });
    await vi.waitFor(() => expect(received).toHaveLength(1));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ failure: "aborted" });
    holdResponse = false;
  });
});
