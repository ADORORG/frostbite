import { createServer, type Server } from "node:http";

import { jsonValueSchema, type JsonValue } from "@frostbite/shared/chain";

import { isJsonObject } from "./json.ts";
import { GatewayError, type Gateway } from "./gateway.ts";

async function bodyOf(
  request: AsyncIterable<Buffer | string>,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request)
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function failure(id: JsonValue, code: number, message: string): string {
  return JSON.stringify({ error: { code, message }, id, jsonrpc: "2.0" });
}

// Serves the gateway as JSON-RPC over HTTP on the loopback interface (a regtest node is for this machine only).
export function serveGateway(options: {
  readonly gateway: Gateway;
  readonly host?: string;
  readonly port: number;
}): Promise<Server> {
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    let id: JsonValue = null;
    try {
      const parsed = jsonValueSchema.parse(JSON.parse(await bodyOf(request)));
      if (!isJsonObject(parsed))
        throw new GatewayError(-32600, "A request is a JSON object.");
      id = parsed["id"] ?? null;
      const method = parsed["method"];
      const params = parsed["params"] ?? [];
      if (typeof method !== "string" || !Array.isArray(params))
        throw new GatewayError(
          -32600,
          "A request names a method and a list of parameters.",
        );
      const result = await options.gateway(method, params);
      response.end(JSON.stringify({ id, jsonrpc: "2.0", result }));
    } catch (error) {
      response.end(
        error instanceof GatewayError
          ? failure(id, error.code, error.message)
          : failure(
              id,
              -32603,
              error instanceof Error ? error.message : "The gateway failed.",
            ),
      );
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host ?? "127.0.0.1", () =>
      resolve(server),
    );
  });
}
