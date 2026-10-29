import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { parseBaseUrl } from "../../src/base-url.ts";

export type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;
export const servers: Server[] = [];
export async function serve(handler: Handler): Promise<URL> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return parseBaseUrl(
    `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
  );
}

export const safeHeaders = {
  "content-security-policy": "default-src 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
const ready = {
  checks: [{ latencyMs: 3, name: "database", status: "ok" }],
  status: "ready",
};

// A deployment that does everything a healthy one should; each test spoils one thing.
export function healthy(spoil: Partial<Record<string, Handler>> = {}): Handler {
  const routes: Record<string, Handler> = {
    "/": (_, response) => {
      response.writeHead(200, safeHeaders).end("<main><h1>Hello</h1></main>");
    },
    "/api/ready": (_, response) => {
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(ready));
    },
    "/api/v1/platform": (_, response) => {
      response
        .writeHead(200, { "content-type": "application/json" })
        .end('{"apiVersion":"v1"}');
    },
    "/studio": (_, response) => {
      response
        .writeHead(307, { location: "/sign-in?returnTo=%2Fstudio" })
        .end();
    },
    "/scenes/pong.png": (_, response) => {
      response.writeHead(200, { "content-type": "image/png" }).end("x");
    },
    "/games": (_, response) => {
      response.writeHead(200).end("games");
    },
    ...spoil,
  };
  return (request, response) => {
    const route = routes[request.url ?? ""];
    if (route === undefined) response.writeHead(404).end();
    else route(request, response);
  };
}

// Closes every server a test started.
export async function closeServers(): Promise<void> {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((done) => server.close(done))),
  );
}
