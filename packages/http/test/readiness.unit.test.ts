import type { ReadinessProbe } from "@ador/shared/readiness";
import { readinessSchema } from "@ador/shared/readiness";
import { describe, expect, it, vi } from "vitest";

import { runReadiness } from "../src/readiness.ts";

const ok = (name: ReadinessProbe["name"]): ReadinessProbe => ({
  check: async () => undefined,
  name,
});
const failing = (
  name: ReadinessProbe["name"],
  message = "refused",
): ReadinessProbe => ({
  check: async () => {
    throw new Error(message);
  },
  name,
});
const hanging = (name: ReadinessProbe["name"]): ReadinessProbe => ({
  check: () => new Promise<void>(() => undefined),
  name,
});

describe("readiness", () => {
  it("is ready when every probe answers, and the answer fits its public schema", async () => {
    const readiness = await runReadiness([
      ok("database"),
      ok("object-storage"),
    ]);
    expect(readiness.status).toBe("ready");
    expect(readiness.checks.map(({ name, status }) => [name, status])).toEqual([
      ["database", "ok"],
      ["object-storage", "ok"],
    ]);
    expect(readinessSchema.safeParse(readiness).success).toBe(true);
  });

  it("is not ready when one probe fails, and still reports the others", async () => {
    const readiness = await runReadiness([
      ok("database"),
      failing("object-storage"),
    ]);
    expect(readiness.status).toBe("not-ready");
    expect(readiness.checks.map(({ status }) => status)).toEqual([
      "ok",
      "failed",
    ]);
  });

  it("is ready for no probes at all, since nothing is wrong", async () => {
    expect(await runReadiness([])).toEqual({ checks: [], status: "ready" });
  });

  it("does not wait on a probe that never answers: it reports it timed out", async () => {
    const readiness = await runReadiness(
      [hanging("database"), ok("object-storage")],
      {
        timeoutMs: 20,
      },
    );
    expect(readiness.status).toBe("not-ready");
    expect(readiness.checks.map(({ status }) => status)).toEqual([
      "timed-out",
      "ok",
    ]);
  });

  it("tries the probes at the same time, so the slowest sets the time taken", async () => {
    const slow = (name: ReadinessProbe["name"]): ReadinessProbe => ({
      check: () => new Promise((resolve) => setTimeout(resolve, 60)),
      name,
    });
    const started = Date.now();
    await runReadiness([slow("database"), slow("object-storage")], {
      timeoutMs: 1_000,
    });
    expect(Date.now() - started).toBeLessThan(110);
  });

  it("hands the reason for a failure to the service's log and never into the answer", async () => {
    const onFailure = vi.fn();
    const readiness = await runReadiness(
      [failing("database", "password authentication failed for user app")],
      { onFailure },
    );
    expect(onFailure).toHaveBeenCalledWith(
      "database",
      expect.objectContaining({
        message: "password authentication failed for user app",
      }),
    );
    expect(JSON.stringify(readiness)).not.toContain("password");
  });

  it("logs a failure that is not an Error as a plain failure", async () => {
    const onFailure = vi.fn();
    await runReadiness(
      [{ check: () => Promise.reject("nope"), name: "database" }],
      { onFailure },
    );
    expect(onFailure).toHaveBeenCalledWith(
      "database",
      expect.objectContaining({ message: "Probe failed." }),
    );
  });

  it("measures how long each probe took", async () => {
    let clock = 100;
    const readiness = await runReadiness([ok("database")], {
      now: () => (clock += 7),
    });
    expect(readiness.checks[0]?.latencyMs).toBe(7);
  });
});
