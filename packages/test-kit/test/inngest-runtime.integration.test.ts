import { spawnSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  freePort,
  startInngestRuntime,
  type InngestRuntime,
  waitFor,
} from "../src/inngest-runtime.ts";
import { runtimeApi } from "../src/inngest-runtime-api.ts";

const keys = {
  eventKey: "0123456789abcdef0123456789abcdef",
  signingKey: "ab".repeat(32),
};
let runtime: InngestRuntime;

beforeAll(async () => {
  runtime = await startInngestRuntime({
    appPort: await freePort(),
    hostPort: await freePort(),
    retryIntervalSeconds: 1,
    ...keys,
  });
}, 120_000);

afterAll(async () => {
  await runtime?.stop();
});

describe("the disposable Inngest runtime", () => {
  it("is healthy, authenticates its REST API, and exposes its logs", async () => {
    expect((await fetch(`${runtime.baseUrl}/health`)).ok).toBe(true);
    expect((await fetch(`${runtime.baseUrl}/v1/events`)).status).toBe(401);
    expect(await runtime.logs()).toContain("starting server");
    expect(runtime.eventKey).toBe(keys.eventKey);
    expect(runtime.signingKey).toBe(keys.signingKey);
  });

  it("reads events and runs through the REST API", async () => {
    const api = runtimeApi(runtime, keys.signingKey);
    expect(await api.eventRecordCount("missing")).toBe(0);
    expect(await api.runCount("missing")).toBe(0);
    expect(await api.status("missing")).toBeUndefined();
    const send = () =>
      fetch(`${runtime.baseUrl}/e/${keys.eventKey}`, {
        body: JSON.stringify({ data: {}, id: "event-1", name: "kit.test.v1" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    expect((await send()).ok).toBe(true);
    expect((await send()).ok).toBe(true);
    await waitFor(
      async () =>
        (await api.eventRecordCount("event-1")) === 2 ? true : undefined,
      10_000,
      "both event records",
    );
    expect(await api.runCount("event-1")).toBe(0);
    expect(await api.status("event-1")).toBeUndefined();
    await expect(
      runtimeApi(runtime, "wrong").eventRecordCount("event-1"),
    ).rejects.toThrow("401");
  });

  it("removes its container on stop, and stopping twice is harmless", async () => {
    const stopping = await startInngestRuntime({
      appPort: await freePort(),
      hostPort: await freePort(),
      retryIntervalSeconds: 1,
      ...keys,
    });
    const name = () =>
      spawnSync(
        "docker",
        ["ps", "-a", "--filter", "name=ador-inngest", "--format", "{{.Names}}"],
        { encoding: "utf8" },
      )
        .stdout.split("\n")
        .filter(Boolean);
    const during = name().length;
    await stopping.stop();
    await stopping.stop();
    expect(name().length).toBe(during - 1);
  }, 120_000);

  const containers = () =>
    spawnSync(
      "docker",
      ["ps", "-a", "--filter", "name=ador-inngest", "--format", "{{.Names}}"],
      { encoding: "utf8" },
    )
      .stdout.split("\n")
      .filter(Boolean);

  it("fails and leaves no container behind when the image cannot start", async () => {
    const before = containers().length;
    await expect(
      startInngestRuntime({
        appPort: await freePort(),
        hostPort: await freePort(),
        image: "ador-test/does-not-exist:0",
        retryIntervalSeconds: 1,
        ...keys,
      }),
    ).rejects.toThrow("docker exited with code");
    expect(containers().length).toBe(before);
  }, 120_000);

  it("fails and cleans up when the runtime never becomes ready", async () => {
    const before = containers().length;
    await expect(
      startInngestRuntime({
        appPort: await freePort(),
        hostPort: await freePort(),
        image: "postgres:18.6-alpine",
        readyTimeoutMs: 1_500,
        retryIntervalSeconds: 1,
        ...keys,
      }),
    ).rejects.toThrow("did not become ready");
    expect(containers().length).toBe(before);
  }, 120_000);

  it("removes its container when the process is signalled", async () => {
    const terminated: string[] = [];
    const before = containers().length;
    const interrupted = await startInngestRuntime({
      appPort: await freePort(),
      hostPort: await freePort(),
      retryIntervalSeconds: 1,
      terminate: (signal) => void terminated.push(signal),
      ...keys,
    });
    expect(containers().length).toBe(before + 1);
    const listeners = process.listeners("SIGTERM");
    const handler = listeners[listeners.length - 1];
    handler?.("SIGTERM");
    handler?.("SIGTERM");
    expect(terminated).toEqual(["SIGTERM", "SIGTERM"]);
    expect(containers().length).toBe(before);
    await interrupted.stop();
  }, 120_000);
});
