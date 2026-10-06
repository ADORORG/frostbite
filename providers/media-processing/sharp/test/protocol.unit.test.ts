import { describe, expect, it } from "vitest";

import {
  decodeFrame,
  encodeFrame,
  maximumHeaderBytes,
  responseHeaderSchema,
} from "../src/protocol.ts";

const rejection = { ok: false, reason: "decode-failed" } as const;

describe("frame protocol", () => {
  it("round-trips a header and payload", () => {
    const frame = encodeFrame(rejection, Buffer.from([1, 2, 3]));
    const decoded = decodeFrame(frame, responseHeaderSchema);
    expect(decoded?.header).toEqual(rejection);
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
      Buffer.concat([Buffer.from([0, 0, 0, 3]), Buffer.from("{x}")]),
    ],
    [
      "a header of the wrong shape",
      encodeFrame({ ok: "yes" }, Buffer.alloc(0)),
    ],
  ])("rejects %s", (_name, frame) => {
    expect(decodeFrame(frame, responseHeaderSchema)).toBeNull();
  });

  it("rejects a valid header that exceeds the size cap", () => {
    const json = JSON.stringify(rejection);
    const header = json + " ".repeat(maximumHeaderBytes + 1 - json.length);
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(header.length);
    const frame = Buffer.concat([prefix, Buffer.from(header)]);
    expect(frame.length).toBe(4 + maximumHeaderBytes + 1);
    expect(decodeFrame(frame, responseHeaderSchema)).toBeNull();
  });

  it("rejects a frame whose prefix claims more header than was sent", () => {
    const frame = encodeFrame(rejection, Buffer.alloc(0));
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
        encodeFrame({ ...rejection, extra: true }, Buffer.alloc(0)),
        responseHeaderSchema,
      ),
    ).toBeNull();
  });
});
