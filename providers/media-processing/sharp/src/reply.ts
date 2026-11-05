import type {
  ProcessImageInput,
  ProcessImageResult,
} from "@frostbite/media/processing";

import { decodeFrame, responseHeaderSchema } from "./protocol.ts";

export class WorkerReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerReplyError";
  }
}

// Validates everything a worker says against what was asked: count, kinds, order, byte caps, size
// boxes, and the payload length. A violation is a platform fault, not a property of the file.
export function interpretReply(
  frame: Uint8Array,
  input: ProcessImageInput,
  maxDerivativeBytes: number,
): ProcessImageResult {
  const reply = decodeFrame(frame, responseHeaderSchema);
  if (reply === null)
    throw new WorkerReplyError("Worker sent an invalid frame.");
  if (!reply.header.ok) return { ok: false, reason: reply.header.reason };
  const { derivatives } = reply.header;
  const total = derivatives.reduce(
    (sum, { byteLength }) => sum + byteLength,
    0,
  );
  const consistent =
    derivatives.length === input.derivatives.length &&
    total === reply.payload.length &&
    derivatives.every((derivative, index) => {
      const request = input.derivatives[index];
      return (
        request !== undefined &&
        derivative.kind === request.kind &&
        derivative.byteLength <= maxDerivativeBytes &&
        derivative.width <= request.maxSide &&
        derivative.height <= request.maxSide
      );
    });
  if (!consistent)
    throw new WorkerReplyError("Worker sent an inconsistent reply.");
  let offset = 0;
  return {
    derivatives: derivatives.map(({ byteLength, height, kind, width }) => {
      const bytes = Uint8Array.from(
        reply.payload.subarray(offset, offset + byteLength),
      );
      offset += byteLength;
      return { bytes, height, kind, width };
    }),
    ok: true,
  };
}
