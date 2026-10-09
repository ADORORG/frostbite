import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it } from "vitest";

import { createWorkerRuntime } from "../src/runtime.ts";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "2",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
};

describe("worker runtime", () => {
  it("answers liveness without any provider or database connection", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      const response = await runtime.handle(
        new Request("http://worker/health"),
      );
      expect([response.status, await response.json()]).toEqual([
        200,
        { status: "ok" },
      ]);
    } finally {
      await runtime.close();
    }
  });

  it("surfaces a missing workflow provider when the signed endpoint is first used", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      await expect(
        runtime.handle(new Request("http://worker/api/inngest")),
      ).rejects.toThrow();
    } finally {
      await runtime.close();
    }
  });

  it("returns from the relay loop without running a pass when it is already stopped", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      const stopped = new AbortController();
      stopped.abort();
      const errors: Error[] = [];
      await runtime.runRelay(stopped.signal, (error) => errors.push(error));
      expect(errors).toEqual([]);
    } finally {
      await runtime.close();
    }
  });

  it("reports a relay failure and keeps running until stopped", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      const controller = new AbortController();
      const errors: Error[] = [];
      const running = runtime.runRelay(controller.signal, (error) => {
        errors.push(error);
        controller.abort();
      });
      await running;
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toBeTruthy();
    } finally {
      await runtime.close();
    }
  });

  it("returns from the cleanup loop without running a pass when it is already stopped", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      const stopped = new AbortController();
      stopped.abort();
      const seen: string[] = [];
      await runtime.runCleanup(stopped.signal, {
        onError: (error) => seen.push(error.message),
        onResult: () => seen.push("result"),
      });
      expect(seen).toEqual([]);
    } finally {
      await runtime.close();
    }
  });

  it("reports a cleanup failure and keeps running until stopped", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
    });
    try {
      const controller = new AbortController();
      const errors: Error[] = [];
      await runtime.runCleanup(controller.signal, {
        onError: (error) => {
          errors.push(error);
          controller.abort();
        },
        onResult: () => undefined,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toBeTruthy();
    } finally {
      await runtime.close();
    }
  });

  it("refuses to start with an invalid database configuration", () => {
    expect(() =>
      createWorkerRuntime({
        environment: {},
        providers: createProviderRegistry([]),
      }),
    ).toThrow();
  });
});
