import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import { describe, expect, it, vi } from "vitest";

import { createWorkerRuntime } from "../src/runtime.ts";
import { rowSweepLimits } from "./support/row-sweep-limits.ts";

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
      rowSweepLimits,
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

  it("answers readiness 503 and names both checks when the database and object storage do not answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const runtime = createWorkerRuntime({
      environment: {
        ...environment,
        DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
      },
      providers: createProviderRegistry([]),
      rowSweepLimits,
    });
    try {
      const response = await runtime.handle(new Request("http://worker/ready"));
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body.status).toBe("not-ready");
      expect(body.checks.map(({ name }: { name: string }) => name)).toEqual([
        "database",
        "object-storage",
      ]);
      expect(
        body.checks.every(({ status }: { status: string }) => status !== "ok"),
      ).toBe(true);
      // What went wrong is logged, not returned.
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("readiness: object-storage is not ready"),
      );
      expect(JSON.stringify(body)).not.toContain("provider");
    } finally {
      log.mockRestore();
      await runtime.close();
    }
  });

  it("surfaces a missing workflow provider when the signed endpoint is first used", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
      rowSweepLimits,
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
      rowSweepLimits,
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
      rowSweepLimits,
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
      rowSweepLimits,
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
      rowSweepLimits,
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
        rowSweepLimits,
      }),
    ).toThrow();
  });
});
