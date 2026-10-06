import { createServer } from "node:http";

import {
  createNodeRequestListener,
  type FetchHandler,
} from "@ador/http/node-adapter";

export interface ServedRequest {
  readonly method: string;
  readonly path: string;
  readonly rawBody: string;
  readonly signature: string | undefined;
  readonly status: number;
}

export interface ServedEndpoint {
  readonly port: number;
  readonly requests: ServedRequest[];
  stop(): Promise<void>;
}

// Serves a fetch-style handler on all interfaces so a container can reach it; test use only. Every
// exchange is recorded so tests can assert what the workflow runtime actually sent.
export async function serveFetchHandler(
  handler: FetchHandler,
): Promise<ServedEndpoint> {
  const requests: ServedRequest[] = [];
  const server = createServer(
    createNodeRequestListener(handler, {
      observe: ({ body, request, response }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          rawBody: Buffer.from(body).toString("utf8"),
          signature: request.headers.get("x-inngest-signature") ?? undefined,
          status: response.status,
        });
      },
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  const address = server.address();
  /* v8 ignore next 2 -- a listening TCP server always reports an address object. */
  if (address === null || typeof address === "string")
    throw new Error("Test server did not bind a TCP port.");
  return {
    port: address.port,
    requests,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
