import { derivativeKinds } from "@frostbite/shared/uploads";
import { describe, expect, it } from "vitest";

import {
  isWorkerFault,
  workerExitCodes as parentExitCodes,
} from "../src/exit-codes.ts";
import {
  decodeFrame,
  encodeFrame,
  maximumHeaderBytes,
  responseHeaderSchema,
} from "../src/protocol.ts";
import { handleRequest, parseRequest, workerExitCodes } from "../src/worker.ts";
import { makeImage } from "./support/images.ts";

const valid = {
  byteLength: 3,
  derivatives: [
    { kind: "thumbnail", maxSide: 256 },
    { kind: "preview", maxSide: 1_024 },
  ],
  expected: { height: 5, width: 7 },
  limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
  quality: 80,
};
const request = (
  header: object,
  payload: Uint8Array = Buffer.from([1, 2, 3]),
) => encodeFrame(header, payload);

describe("worker request parsing", () => {
  it("accepts a well-formed request and returns its options and payload", () => {
    const parsed = parseRequest(request(valid));
    expect(parsed?.options).toEqual({
      derivatives: valid.derivatives,
      expected: valid.expected,
      limits: valid.limits,
      quality: 80,
    });
    expect([...(parsed?.payload ?? [])]).toEqual([1, 2, 3]);
  });

  it("accepts the numeric bounds", () => {
    expect(parseRequest(request({ ...valid, quality: 1 }))).not.toBeNull();
    expect(parseRequest(request({ ...valid, quality: 100 }))).not.toBeNull();
    expect(
      parseRequest(request({ ...valid, byteLength: 0 }, Buffer.alloc(0))),
    ).not.toBeNull();
  });

  it.each([
    ["an empty frame", Buffer.alloc(0)],
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
      Buffer.concat([Buffer.from([0, 0, 0, 3]), Buffer.from("{x}")]),
    ],
    ["a header that is an array", request([])],
    ["a header that is null", request(JSON.parse("null"))],
    ["a payload shorter than declared", request(valid, Buffer.alloc(2))],
    ["a payload longer than declared", request(valid, Buffer.alloc(4))],
    ["an extra header field", request({ ...valid, extra: 1 })],
    ["a missing header field", request({ ...valid, quality: undefined })],
    ["a negative byte length", request({ ...valid, byteLength: -1 })],
    ["a fractional byte length", request({ ...valid, byteLength: 1.5 })],
    ["a text byte length", request({ ...valid, byteLength: "3" })],
    ["no derivatives", request({ ...valid, derivatives: [] })],
    ["derivatives that are not a list", request({ ...valid, derivatives: {} })],
    [
      "a derivative that is not an object",
      request({ ...valid, derivatives: [1] }),
    ],
    [
      "a derivative with an extra field",
      request({
        ...valid,
        derivatives: [{ kind: "thumbnail", maxSide: 1, extra: 1 }],
      }),
    ],
    [
      "an unknown derivative kind",
      request({ ...valid, derivatives: [{ kind: "banner", maxSide: 1 }] }),
    ],
    [
      "a zero derivative size",
      request({ ...valid, derivatives: [{ kind: "thumbnail", maxSide: 0 }] }),
    ],
    [
      "a fractional derivative size",
      request({ ...valid, derivatives: [{ kind: "thumbnail", maxSide: 1.5 }] }),
    ],
    [
      "one bad derivative among good ones",
      request({
        ...valid,
        derivatives: [valid.derivatives[0], { kind: "x", maxSide: 1 }],
      }),
    ],
    [
      "expected dimensions that are not an object",
      request({ ...valid, expected: 1 }),
    ],
    [
      "expected dimensions with an extra field",
      request({ ...valid, expected: { height: 1, width: 1, depth: 1 } }),
    ],
    [
      "a zero expected width",
      request({ ...valid, expected: { height: 5, width: 0 } }),
    ],
    [
      "a zero expected height",
      request({ ...valid, expected: { height: 0, width: 5 } }),
    ],
    ["limits that are not an object", request({ ...valid, limits: 1 })],
    [
      "limits with an extra field",
      request({ ...valid, limits: { ...valid.limits, extra: 1 } }),
    ],
    [
      "a zero dimension limit",
      request({ ...valid, limits: { maxDimension: 0, maxPixels: 1 } }),
    ],
    [
      "a zero pixel limit",
      request({ ...valid, limits: { maxDimension: 1, maxPixels: 0 } }),
    ],
    ["a quality of zero", request({ ...valid, quality: 0 })],
    ["a quality above one hundred", request({ ...valid, quality: 101 })],
    ["a fractional quality", request({ ...valid, quality: 80.5 })],
    ["a text quality", request({ ...valid, quality: "80" })],
  ])("rejects %s", (_name, frame) => {
    expect(parseRequest(frame)).toBeNull();
  });
});

describe("worker request handling", () => {
  it("answers a valid request with a reply the parent's protocol accepts", async () => {
    const bytes = await makeImage({ format: "png", height: 30, width: 40 });
    const reply = await handleRequest(
      request(
        {
          ...valid,
          byteLength: bytes.length,
          expected: { height: 30, width: 40 },
        },
        bytes,
      ),
    );
    const decoded = decodeFrame(reply ?? Buffer.alloc(0), responseHeaderSchema);
    expect(decoded?.header).toMatchObject({
      derivatives: [
        { height: 30, kind: "thumbnail", width: 40 },
        { height: 30, kind: "preview", width: 40 },
      ],
      ok: true,
    });
    const lengths = decoded?.header.ok
      ? decoded.header.derivatives.map(({ byteLength }) => byteLength)
      : [];
    expect(decoded?.payload.length).toBe(
      lengths.reduce((sum, length) => sum + length, 0),
    );
  });

  it("answers an undecodable payload with a rejection and no payload", async () => {
    const decoded = decodeFrame(
      (await handleRequest(request(valid))) ?? Buffer.alloc(0),
      responseHeaderSchema,
    );
    expect(decoded).toMatchObject({
      header: { ok: false, reason: "decode-failed" },
    });
    expect(decoded?.payload.length).toBe(0);
  });

  it("refuses frames that violate the protocol", async () => {
    expect(await handleRequest(Buffer.from("garbage"))).toBeNull();
    expect(await handleRequest(request(valid, Buffer.alloc(2)))).toBeNull();
  });
});

// The worker is a self-contained file, so these values are duplicated rather than imported.
describe("constants shared with the parent", () => {
  it("keeps the exit codes identical", () => {
    expect(workerExitCodes).toEqual(parentExitCodes);
    expect(isWorkerFault(workerExitCodes.protocolViolation)).toBe(true);
    expect(isWorkerFault(workerExitCodes.unexpectedError)).toBe(true);
  });

  it("accepts exactly the derivative kinds the platform defines", () => {
    for (const kind of derivativeKinds)
      expect(
        parseRequest(
          request({ ...valid, derivatives: [{ kind, maxSide: 10 }] }),
        ),
      ).not.toBeNull();
    expect(derivativeKinds).toEqual(["thumbnail", "preview"]);
  });

  it("enforces the same header cap as the parent", () => {
    const json = JSON.stringify(valid);
    const header = json + " ".repeat(maximumHeaderBytes - json.length);
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(header.length);
    expect(
      parseRequest(
        Buffer.concat([prefix, Buffer.from(header), Buffer.from([1, 2, 3])]),
      ),
    ).not.toBeNull();
    prefix.writeUInt32BE(header.length + 1);
    expect(
      parseRequest(
        Buffer.concat([
          prefix,
          Buffer.from(header + " "),
          Buffer.from([1, 2, 3]),
        ]),
      ),
    ).toBeNull();
  });
});
