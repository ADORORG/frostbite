import { defaultMaxBodyBytes } from "./node-adapter.ts";

// Reads a request's JSON body without buffering more than `limit` bytes (by default the ceiling the Node adapter holds
// services to; the largest body an operation accepts, a saved game state or a run record, is far below it). A body that is too large, is not UTF-8, or is not
// JSON is `undefined`, which the operation's schema then refuses as an invalid request: the caller never sees the
// difference between them, and the server never holds more than the limit.
export async function readJsonBody(
  request: Request,
  limit: number = defaultMaxBodyBytes,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit || request.body === null) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
