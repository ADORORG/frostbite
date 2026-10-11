import type { Readiness, ReadinessProbe } from "@ador/shared/readiness";

export const defaultReadinessTimeoutMs = 2_000;

// Tries every probe at once, each with its own time limit, and says whether the service can take traffic: only
// when every probe answered. A slow dependency is reported as timed out rather than waited on, so a check never
// hangs the platform that asks for it. Failures are handed to `onFailure` for the service's own log and are never
// part of the answer.
export async function runReadiness(
  probes: readonly ReadinessProbe[],
  options: {
    readonly now?: () => number;
    readonly onFailure?: (name: string, error: Error) => void;
    readonly timeoutMs?: number;
  } = {},
): Promise<Readiness> {
  const {
    now = Date.now,
    onFailure,
    timeoutMs = defaultReadinessTimeoutMs,
  } = options;
  const checks = await Promise.all(
    probes.map(async ({ check, name }) => {
      const started = now();
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("timed out")),
        timeoutMs,
      );
      try {
        await Promise.race([
          check(controller.signal),
          new Promise<never>((_, reject) =>
            controller.signal.addEventListener(
              "abort",
              () => reject(controller.signal.reason),
              { once: true },
            ),
          ),
        ]);
        return { latencyMs: now() - started, name, status: "ok" as const };
      } catch (error) {
        const timedOut = controller.signal.aborted;
        onFailure?.(
          name,
          error instanceof Error ? error : new Error("Probe failed."),
        );
        return {
          latencyMs: now() - started,
          name,
          status: timedOut ? ("timed-out" as const) : ("failed" as const),
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return {
    checks,
    status: checks.every(({ status }) => status === "ok")
      ? "ready"
      : "not-ready",
  };
}
