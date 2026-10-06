import { processImage } from "./process-image.ts";
import {
  decodeFrame,
  encodeFrame,
  requestHeaderSchema,
  type ResponseHeader,
} from "./protocol.ts";

// Turns one request frame into one reply frame; null means the request violated the protocol.
export async function handleRequest(frame: Buffer): Promise<Buffer | null> {
  const request = decodeFrame(frame, requestHeaderSchema);
  if (request === null || request.payload.length !== request.header.byteLength)
    return null;
  const { derivatives, expected, limits, quality } = request.header;
  const result = await processImage({
    bytes: request.payload,
    derivatives,
    expected,
    limits,
    quality,
  });
  if (!result.ok)
    return encodeFrame(
      { ok: false, reason: result.reason } satisfies ResponseHeader,
      Buffer.alloc(0),
    );
  const header: ResponseHeader = {
    derivatives: result.derivatives.map((derivative) => ({
      byteLength: derivative.bytes.length,
      height: derivative.height,
      kind: derivative.kind,
      width: derivative.width,
    })),
    ok: true,
  };
  return encodeFrame(
    header,
    Buffer.concat(result.derivatives.map(({ bytes }) => bytes)),
  );
}
