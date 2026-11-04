import { defaultMaintenanceLoopPolicy } from "@ador/jobs/policy";
import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it, vi } from "vitest";

const drain = vi.hoisted(() => ({
  run: vi.fn<(dependencies: object, policy: object) => Promise<void>>(
    async () => undefined,
  ),
}));
vi.mock("@ador/jobs/drain-loop", () => ({ runDrainLoop: drain.run }));

import { createWorkerRuntime } from "../src/runtime.ts";
import { rowSweepLimits } from "./support/row-sweep-limits.ts";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
};

describe("how the worker runs the row sweeps", () => {
  it("polls slowly, like the other housekeeping, because finished rows have no latency target", async () => {
    const runtime = createWorkerRuntime({
      environment,
      providers: createProviderRegistry([]),
      rowSweepLimits,
    });
    try {
      const errors: Error[] = [];
      await runtime.runRowSweeps(new AbortController().signal, {
        onError: (error) => void errors.push(error),
        onResult: () => undefined,
      });
      expect(drain.run).toHaveBeenCalledOnce();
      const [dependencies, policy] = drain.run.mock.calls[0] ?? [];
      expect(policy).toBe(defaultMaintenanceLoopPolicy);
      expect(dependencies).toMatchObject({
        failureMessage: "Row sweep failed.",
      });
    } finally {
      await runtime.close();
    }
  });
});
