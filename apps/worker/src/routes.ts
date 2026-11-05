import type { Readiness } from "@frostbite/shared/readiness";

import { livenessPath, readinessPath, workflowEndpointPath } from "./config.ts";
import type { SignedWorkflowEndpoint } from "@frostbite/jobs/provider-service";

const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

// Routes the worker's endpoints. Liveness says only that the process answers. Readiness says whether the
// database and object storage answer, 200 or 503, and names nothing else.
export function createWorkerRoutes(dependencies: {
  readonly endpoint: () => Promise<SignedWorkflowEndpoint>;
  readonly readiness: () => Promise<Readiness>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === livenessPath)
      return request.method === "GET"
        ? Response.json({ status: "ok" })
        : notFound();
    if (pathname === readinessPath) {
      if (request.method !== "GET") return notFound();
      const readiness = await dependencies.readiness();
      return Response.json(readiness, {
        headers: { "cache-control": "no-store" },
        status: readiness.status === "ready" ? 200 : 503,
      });
    }
    if (pathname === workflowEndpointPath)
      return (await dependencies.endpoint())(request);
    return notFound();
  };
}
