import type { Readable } from "node:stream";

import { ObjectStorageError } from "@ador/object-storage/errors";

// Buffers at most `limit` bytes, so memory is bounded by the declared size. Returns null as soon
// as the object proves larger; the stream is always destroyed.
export async function readUpTo(
  body: Readable,
  limit: number,
): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of body) {
      if (!(chunk instanceof Uint8Array)) {
        throw new ObjectStorageError(
          "invalid-provider-response",
          "Object body produced a non-binary chunk.",
        );
      }
      total += chunk.length;
      if (total > limit) return null;
      chunks.push(chunk);
    }
  } finally {
    body.destroy();
  }
  return Buffer.concat(chunks);
}
