import { createServer, type Server } from "node:http";

import { afterEach } from "vitest";

import {
  createNodeRequestListener,
  type FetchHandler,
  type NodeAdapterOptions,
} from "../../src/node-adapter.ts";

// Starts servers over the adapter and closes every one after each test.
export function useNodeServers(): (
  handler: FetchHandler,
  options?: NodeAdapterOptions,
) => Promise<number> {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });
  return async (handler, options) => {
    const server = createServer(createNodeRequestListener(handler, options));
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("no port");
    return address.port;
  };
}
