import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { StackActor } from "./manual-stack.ts";
import {
  renderPicker,
  signInPath,
  signInResponse,
  signOutPath,
  signOutResponse,
  type DevResponse,
} from "./sign-in-picker.ts";

// The local stack's front door: serves the test sign-in page and passes every other request to the web
// server unchanged. Keeping the sign-in out of the web app means no test shortcut ships with it.

const maximumFormBytes = 4_096;

export interface StackProxyOptions {
  readonly actors: readonly StackActor[];
  // The origin people use, e.g. http://localhost:4174. A sign-in posted from any other origin is refused.
  readonly origin: string;
  readonly upstreamPort: number;
}

function send(response: ServerResponse, result: DevResponse): void {
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = Buffer.from(chunk);
    size += part.length;
    if (size > maximumFormBytes) throw new Error("Form too large");
    chunks.push(part);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function forward(
  request: IncomingMessage,
  response: ServerResponse,
  upstreamPort: number,
): void {
  const upstream = httpRequest(
    {
      headers: request.headers,
      host: "127.0.0.1",
      method: request.method,
      path: request.url,
      port: upstreamPort,
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end("The web server is not answering.");
  });
  request.pipe(upstream);
}

export function createStackProxy(options: StackProxyOptions): Server {
  return createServer((request, response) => {
    const path = new URL(request.url ?? "/", options.origin).pathname;
    if (request.method === "GET" && path === signInPath)
      return send(response, renderPicker(options.actors));
    if (
      request.method === "POST" &&
      (path === signInPath || path === signOutPath)
    ) {
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== options.origin) {
        response.writeHead(403).end("Cross-origin sign-in refused.");
        return;
      }
      readForm(request).then(
        (form) =>
          send(
            response,
            path === signInPath
              ? signInResponse(options.actors, form)
              : signOutResponse(),
          ),
        () => response.writeHead(413).end("Form too large."),
      );
      return;
    }
    forward(request, response, options.upstreamPort);
  });
}
