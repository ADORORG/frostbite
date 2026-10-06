// Where the signed workflow endpoint and the liveness probe are served.
export const workflowEndpointPath = "/api/inngest";
export const livenessPath = "/health";

// Used only when the platform injects no PORT (local runs). PORT is a provider-injected system
// variable classified outside the application's environment inventory (ADR-012).
export const defaultWorkerPort = 3001;

export function parseWorkerPort(source: NodeJS.ProcessEnv): number {
  const raw = source.PORT;
  if (raw === undefined || raw.trim() === "") return defaultWorkerPort;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new RangeError(
      `PORT must be an integer from 1 to 65535, received "${raw}".`,
    );
  return port;
}
