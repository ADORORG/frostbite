import type { IncomingMessage, ServerResponse } from "node:http";

export type FetchHandler = (request: Request) => Promise<Response>;

// A body larger than this is refused before it is buffered: services behind this adapter are
// reachable by unauthenticated callers, and a signature can only be checked once the body is read.
export const defaultMaxBodyBytes = 1_048_576;

class PayloadTooLargeError extends Error {}

export interface NodeAdapterOptions {
  readonly maxBodyBytes?: number;
  // Called after each exchange with the raw request body, for tests and diagnostics.
  readonly observe?: (exchange: {
    readonly body: Uint8Array;
    readonly request: Request;
    readonly response: Response;
  }) => void;
  // Called when the handler throws; the client only ever sees a generic 500.
  readonly onError?: (error: Error) => void;
}

async function readBody(
  incoming: IncomingMessage,
  limit: number,
): Promise<Buffer> {
  const declared = Number(incoming.headers["content-length"]);
  if (declared > limit)
    throw new PayloadTooLargeError("Declared body is too large.");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of incoming) {
    total += chunk.length;
    if (total > limit) throw new PayloadTooLargeError("Body is too large.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toRequest(incoming: IncomingMessage, body: Buffer): Request {
  const { method, url } = incoming;
  const { host } = incoming.headers;
  /* v8 ignore next 2 -- Node always sets these on a server-side HTTP/1.1 request. */
  if (method === undefined || url === undefined || host === undefined)
    throw new Error("Incoming request has no method, URL, or Host.");
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers))
    if (typeof value === "string") headers.set(name, value);
  return new Request(new URL(url, `http://${host}`), {
    ...(method === "GET" || method === "HEAD"
      ? {}
      : { body: new Uint8Array(body) }),
    headers,
    method,
  });
}

// Adapts a fetch-style handler to a `node:http` request listener. The adapter is delivery plumbing
// only: it buffers the request, runs the handler, and writes the response.
export function createNodeRequestListener(
  handler: FetchHandler,
  options: NodeAdapterOptions = {},
): (incoming: IncomingMessage, outgoing: ServerResponse) => void {
  return (incoming, outgoing) => {
    void (async () => {
      try {
        const body = await readBody(
          incoming,
          options.maxBodyBytes ?? defaultMaxBodyBytes,
        );
        const request = toRequest(incoming, body);
        const response = await handler(request);
        options.observe?.({ body, request, response: response.clone() });
        outgoing.writeHead(
          response.status,
          Object.fromEntries(response.headers),
        );
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        if (error instanceof PayloadTooLargeError) {
          outgoing.writeHead(413, {
            connection: "close",
            "content-type": "application/json",
          });
          // `connection: close` makes Node drop the socket, and the unread rest of the body, after this
          // response is flushed.
          outgoing.end(JSON.stringify({ error: "payload_too_large" }));
          return;
        }
        options.onError?.(
          error instanceof Error ? error : new Error("Handler failed."),
        );
        outgoing.writeHead(500, { "content-type": "application/json" });
        outgoing.end(JSON.stringify({ error: "internal" }));
      }
    })();
  };
}
