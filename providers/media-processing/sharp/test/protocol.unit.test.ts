import { describe, expect, it } from "vitest";

import { handleRequest } from "../src/handle-request.ts";
import {
  decodeFrame,
  encodeFrame,
  maximumHeaderBytes,
  requestHeaderSchema,
  responseHeaderSchema,
} from "../src/protocol.ts";
import { makeImage } from "./support/images.ts";

const request = {
  byteLength: 3,
  derivatives: [{ kind: "thumbnail", maxSide: 256 }],
  expected: { height: 5, width: 7 },
  limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
  quality: 80,
} as const;

describe("frame protocol", () => {
  it("round-trips a header and payload", () => {
    const frame = encodeFrame(request, Buffer.from([1, 2, 3]));
    const decoded = decodeFrame(frame, requestHeaderSchema);
    expect(decoded?.header).toEqual(request);
    expect([...(decoded?.payload ?? [])]).toEqual([1, 2, 3]);
  });

  it.each([
    ["empty input", Buffer.alloc(0)],
    ["a prefix shorter than four bytes", Buffer.from([0, 0])],
    ["a header longer than the frame", Buffer.from([0, 0, 0, 200, 123, 125])],
    [
      "a header over the size cap",
      Buffer.concat([
        Buffer.from([0, 1, 0, 1]),
        Buffer.alloc(maximumHeaderBytes + 1),
      ]),
    ],
    [
      "a header that is not JSON",
      encodeFrame({}, Buffer.alloc(0)).subarray(0, 2).length === 2
        ? Buffer.concat([Buffer.from([0, 0, 0, 3]), Buffer.from("{x}")])
        : Buffer.alloc(0),
    ],
    [
      "a header of the wrong shape",
      encodeFrame({ ok: "yes" }, Buffer.alloc(0)),
    ],
  ])("rejects %s", (_name, frame) => {
    expect(decodeFrame(frame, responseHeaderSchema)).toBeNull();
  });

  it("rejects a valid header that exceeds the size cap", () => {
    const json = '{"ok":false,"reason":"decode-failed"}';
    const header = json + " ".repeat(maximumHeaderBytes + 1 - json.length);
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(header.length);
    const frame = Buffer.concat([prefix, Buffer.from(header)]);
    expect(frame.length).toBe(4 + maximumHeaderBytes + 1);
    expect(decodeFrame(frame, responseHeaderSchema)).toBeNull();
  });

  it("rejects a frame whose prefix claims more header than was sent", () => {
    const frame = encodeFrame(
      { ok: false, reason: "decode-failed" },
      Buffer.alloc(0),
    );
    frame.writeUInt32BE(frame.length, 0);
    expect(decodeFrame(frame, responseHeaderSchema)).toBeNull();
  });

  it("rejects extra header fields and unknown reasons", () => {
    expect(
      decodeFrame(
        encodeFrame({ ok: false, reason: "bad" }, Buffer.alloc(0)),
        responseHeaderSchema,
      ),
    ).toBeNull();
    expect(
      decodeFrame(
        encodeFrame({ ...request, extra: true }, Buffer.alloc(3)),
        requestHeaderSchema,
      ),
    ).toBeNull();
  });
});

describe("request handling", () => {
  it("answers a valid request with derivatives", async () => {
    const bytes = await makeImage({ format: "png", height: 30, width: 40 });
    const reply = await handleRequest(
      encodeFrame(
        {
          ...request,
          byteLength: bytes.length,
          expected: { height: 30, width: 40 },
        },
        bytes,
      ),
    );
    const decoded = decodeFrame(reply ?? Buffer.alloc(0), responseHeaderSchema);
    expect(decoded?.header).toMatchObject({
      derivatives: [{ height: 30, kind: "thumbnail", width: 40 }],
      ok: true,
    });
    expect(decoded?.payload.length).toBeGreaterThan(0);
  });

  it("answers an undecodable payload with a rejection and no payload", async () => {
    const reply = await handleRequest(
      encodeFrame(request, Buffer.from([1, 2, 3])),
    );
    const decoded = decodeFrame(reply ?? Buffer.alloc(0), responseHeaderSchema);
    expect(decoded).toMatchObject({
      header: { ok: false, reason: "decode-failed" },
    });
    expect(decoded?.payload.length).toBe(0);
  });

  it("refuses frames that violate the protocol", async () => {
    expect(await handleRequest(Buffer.from("garbage"))).toBeNull();
    expect(
      await handleRequest(encodeFrame(request, Buffer.alloc(2))),
    ).toBeNull();
    expect(
      await handleRequest(encodeFrame(request, Buffer.alloc(4))),
    ).toBeNull();
  });
});
