import { createServer } from "node:http";

import { createNodeRequestListener } from "@ador/http/node-adapter";

import { providerRegistry } from "@repo/configs/providers";
import { parseWorkerPort } from "./config.ts";
import { createWorkerRuntime } from "./runtime.ts";

// The process entry shell: it only wires signals, a listener, and the runtime. It is excluded from
// in-process coverage; the behavior it starts is covered by the unit and integration suites, and a
// smoke test starts it as a real process.
function log(
  level: "error" | "info",
  message: string,
  fields: object = {},
): void {
  // Structured, secret-free lines; errors carry a message only, never a stack or request content.
  console.error(JSON.stringify({ level, message, ...fields }));
}

const runtime = createWorkerRuntime({
  environment: process.env,
  providers: providerRegistry,
});
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => shutdown.abort());

const port = parseWorkerPort(process.env);
const server = createServer(
  createNodeRequestListener(runtime.handle, {
    onError: (error) =>
      log("error", "request failed", { error: error.message }),
  }),
);
await new Promise<void>((resolve) => server.listen(port, resolve));
log("info", "worker listening", { port });

await Promise.all([
  runtime.runRelay(shutdown.signal, (error) =>
    log("error", "relay pass failed", { error: error.message }),
  ),
  runtime.runCleanup(shutdown.signal, {
    onError: (error) =>
      log("error", "cleanup pass failed", { error: error.message }),
    onResult: ({ claimed, failures, removed }) =>
      log(failures.length > 0 ? "error" : "info", "abandoned uploads", {
        claimed,
        failures,
        removed,
      }),
  }),
]);
// Stop accepting connections and drop idle keep-alive ones so shutdown cannot wait on them; a request
// still in flight (a media step) is allowed to finish.
const closed = new Promise<void>((resolve) => server.close(() => resolve()));
server.closeIdleConnections();
await closed;
await runtime.close();
log("info", "worker stopped");
