import { livenessPath, workflowEndpointPath } from "./config.ts";
import type { SignedWorkflowEndpoint } from "@ador/jobs/provider-service";

const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

// Routes the worker's two endpoints. Liveness says only that the process answers; it reports
// nothing about the database, storage, or workflow provider.
export function createWorkerRoutes(dependencies: {
  readonly endpoint: () => Promise<SignedWorkflowEndpoint>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === livenessPath)
      return request.method === "GET"
        ? Response.json({ status: "ok" })
        : notFound();
    if (pathname === workflowEndpointPath)
      return (await dependencies.endpoint())(request);
    return notFound();
  };
}
