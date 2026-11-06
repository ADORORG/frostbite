import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  containerLogs,
  freePort,
  guardContainer,
  runDocker,
} from "./docker.ts";

export { freePort };

// The Inngest server the tests run against, pinned to a release and its digest: `latest` moved to v1.50.0 on 2026-11-06 and Verify began to fail
// ("validates then processes a published event" ended after validate) with no change of ours. Move the pin on purpose, with the suite run
// against the new release first.
const defaultImage =
  "inngest/inngest:v1.49.0@sha256:ad551e89e493e34db74d155be37dc5549930fcb6eb8382e502c17da9762821c7";
const defaultReadyTimeoutMs = 30_000;

export interface InngestRuntime {
  readonly baseUrl: string;
  readonly eventKey: string;
  logs(): Promise<string>;
  readonly signingKey: string;
  stop(): Promise<void>;
}

// Starts the real, self-hosted Inngest server with event and signing keys enforced, so signed
// requests are exercised exactly as in production. The app endpoint must already be listening
// because the server syncs it once at startup.
export async function startInngestRuntime(input: {
  readonly appPort: number;
  readonly eventKey: string;
  // Host port the runtime listens on, chosen by the caller via freePort().
  readonly hostPort: number;
  readonly retryIntervalSeconds: number;
  // Hex string with an even number of characters, as the server requires.
  readonly signingKey: string;
  // Injectable so cleanup on SIGINT/SIGTERM is testable without ending the test process.
  readonly terminate?: (signal: NodeJS.Signals) => void;
  readonly image?: string;
  readonly readyTimeoutMs?: number;
}): Promise<InngestRuntime> {
  const containerName = `frostbite-inngest-${randomUUID()}`;
  const { eventKey, signingKey } = input;
  const guard = guardContainer(containerName, input.terminate);
  const stop = guard.stop;
  try {
    await runDocker([
      "run",
      "--detach",
      "--name",
      containerName,
      "--add-host",
      "host.docker.internal:host-gateway",
      "--publish",
      `127.0.0.1:${input.hostPort}:8288`,
      input.image ?? defaultImage,
      "inngest",
      "start",
      "--event-key",
      eventKey,
      "--signing-key",
      signingKey,
      "--sdk-url",
      `http://host.docker.internal:${input.appPort}/api/inngest`,
      "--retry-interval",
      String(input.retryIntervalSeconds),
    ]);
    guard.markStarted();
    const baseUrl = `http://127.0.0.1:${input.hostPort}`;
    const deadline =
      Date.now() + (input.readyTimeoutMs ?? defaultReadyTimeoutMs);
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${baseUrl}/health`)).ok)
          return {
            baseUrl,
            eventKey,
            logs: () => containerLogs(containerName),
            signingKey,
            stop,
          };
      } catch {
        // not listening yet
      }
      await delay(250);
    }
    throw new Error("Inngest runtime did not become ready");
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function waitFor<Value>(
  read: () => Promise<Value | undefined> | Value | undefined,
  timeoutMs: number,
  label: string,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await delay(250);
  }
}
