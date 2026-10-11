import { z } from "zod";

// What a service checks before it says it can take traffic. The names are fixed so a dashboard or alert can
// rely on them; a probe never reports more than its name and outcome, because the answer is public.
export const readinessProbeNames = ["database", "object-storage"] as const;
export const readinessProbeNameSchema = z.enum(readinessProbeNames);
export type ReadinessProbeName = z.infer<typeof readinessProbeNameSchema>;

export const readinessCheckSchema = z
  .object({
    latencyMs: z.number().int().nonnegative(),
    name: readinessProbeNameSchema,
    status: z.enum(["ok", "failed", "timed-out"]),
  })
  .strict();

export const readinessSchema = z
  .object({
    checks: z.array(readinessCheckSchema),
    status: z.enum(["ready", "not-ready"]),
  })
  .strict();

export type ReadinessCheck = z.infer<typeof readinessCheckSchema>;
export type Readiness = z.infer<typeof readinessSchema>;

// One dependency to try. It resolves when the dependency answers and rejects when it does not; the reason is
// for the service's own log, never for the response. It must stop when the signal aborts.
export interface ReadinessProbe {
  check(signal: AbortSignal): Promise<void>;
  readonly name: ReadinessProbeName;
}
