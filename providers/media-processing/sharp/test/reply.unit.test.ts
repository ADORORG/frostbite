import { describe, expect, it } from "vitest";

import { encodeFrame } from "../src/protocol.ts";
import { interpretReply, WorkerReplyError } from "../src/reply.ts";

const input = {
  bytes: new Uint8Array(3),
  derivatives: [
    { kind: "thumbnail", maxSide: 256 },
    { kind: "preview", maxSide: 1_024 },
  ],
  expected: { height: 5, width: 7 },
  limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
  quality: 80,
} as const;
const thumbnail = { byteLength: 2, height: 100, kind: "thumbnail", width: 200 };
const preview = { byteLength: 3, height: 500, kind: "preview", width: 900 };

const reply = (header: object, payload: Buffer) => encodeFrame(header, payload);

describe("worker reply interpretation", () => {
  it("splits the payload into derivatives in request order", () => {
    const result = interpretReply(
      reply(
        { derivatives: [thumbnail, preview], ok: true },
        Buffer.from([1, 2, 3, 4, 5]),
      ),
      input,
      1_000,
    );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(
      result.derivatives.map(({ kind, width, height, bytes }) => [
        kind,
        width,
        height,
        [...bytes],
      ]),
    ).toEqual([
      ["thumbnail", 200, 100, [1, 2]],
      ["preview", 900, 500, [3, 4, 5]],
    ]);
  });

  it("passes a worker rejection through unchanged", () => {
    expect(
      interpretReply(
        reply({ ok: false, reason: "decode-failed" }, Buffer.alloc(0)),
        input,
        1_000,
      ),
    ).toEqual({ ok: false, reason: "decode-failed" });
  });

  it.each([
    ["not a frame", Buffer.from("garbage"), "invalid frame"],
    ["an empty reply", Buffer.alloc(0), "invalid frame"],
    [
      "a header of the wrong shape",
      reply({ ok: "yes" }, Buffer.alloc(0)),
      "invalid frame",
    ],
    [
      "a missing derivative",
      reply({ derivatives: [thumbnail], ok: true }, Buffer.alloc(2)),
      "inconsistent",
    ],
    [
      "a swapped order",
      reply({ derivatives: [preview, thumbnail], ok: true }, Buffer.alloc(5)),
      "inconsistent",
    ],
    [
      "swapped kinds that both fit their boxes",
      reply(
        {
          derivatives: [
            { byteLength: 2, height: 10, kind: "preview", width: 10 },
            { byteLength: 3, height: 10, kind: "thumbnail", width: 10 },
          ],
          ok: true,
        },
        Buffer.alloc(5),
      ),
      "inconsistent",
    ],
    [
      "a derivative wider than its box",
      reply(
        { derivatives: [{ ...thumbnail, width: 257 }, preview], ok: true },
        Buffer.alloc(5),
      ),
      "inconsistent",
    ],
    [
      "a derivative taller than its box",
      reply(
        { derivatives: [{ ...thumbnail, height: 257 }, preview], ok: true },
        Buffer.alloc(5),
      ),
      "inconsistent",
    ],
    [
      "a derivative over the byte cap",
      reply(
        {
          derivatives: [{ ...thumbnail, byteLength: 1_001 }, preview],
          ok: true,
        },
        Buffer.alloc(1_004),
      ),
      "inconsistent",
    ],
    [
      "a payload shorter than declared",
      reply({ derivatives: [thumbnail, preview], ok: true }, Buffer.alloc(4)),
      "inconsistent",
    ],
    [
      "a payload longer than declared",
      reply({ derivatives: [thumbnail, preview], ok: true }, Buffer.alloc(6)),
      "inconsistent",
    ],
  ])("throws on %s", (_name, frame, message) => {
    expect(() => interpretReply(frame, input, 1_000)).toThrow(message);
    expect(() => interpretReply(frame, input, 1_000)).toThrow(WorkerReplyError);
  });
});
