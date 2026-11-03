import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { readRequestInput } from "@ador/http/request-input";
import { platformSessionCookieName } from "@ador/shared/auth";
import type { ActiveSession } from "@ador/auth";
import { parseEnvironment } from "@repo/config/env";
import { getOpenApiDocument, resolveApiOperation } from "@repo/configs/api";
import { logAuthUnavailable } from "@/server/http/internal-error-log";
import { refusal } from "@/server/http/refusal";
import { executeNextOperation } from "@/server/http/next-operation";
import { resolvePageAccess } from "@/server/auth/page-access";
import { getPageAccessDependencies } from "@/server/auth/runtime";
import { getRateLimitGate, tooManyRequests } from "@/server/rate-limit";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly segments: readonly string[] }>;
}

async function handle(request: Request, context: RouteContext) {
  const { segments } = await context.params;
  const path = `/api/v1/${segments.join("/")}`;
  if (request.method === "GET" && path === "/api/v1/openapi") {
    return Response.json(await getOpenApiDocument());
  }
  const operation = await resolveApiOperation(request.method, path);
  if (!operation) return refusal("not_found", "Route not found.", 404);
  // The first limit comes before any other work: a flood from one address is answered cheaply, and an operation
  // open to anyone is limited here, by address, because there is no one signed in to count against.
  const byAddress = await getRateLimitGate().byAddress({
    headers: request.headers,
    method: request.method,
    operationId: operation.route.operationId,
    publicOperation: operation.access.kind === "public",
  });
  if (byAddress !== null) return tooManyRequests(byAddress);
  let actorSession: ActiveSession | null = null;
  // Origin protection also covers public qualification mutations; authentication is separate.
  if (request.method !== "GET" && request.method === operation.route.method) {
    const requestOrigin = request.headers.get("origin");
    const canonicalOrigin = new URL(
      parseEnvironment(process.env).PUBLIC_BASE_URL,
    ).origin;
    if (requestOrigin !== canonicalOrigin)
      return refusal("forbidden", "Mutation origin is not permitted.", 403);
  }
  if (operation.access.kind !== "public") {
    const token = (await cookies()).get(platformSessionCookieName)?.value;
    const access = await resolvePageAccess(
      operation.access,
      token,
      getPageAccessDependencies,
    );
    if (access.kind !== "allowed") {
      if (access.kind === "unavailable") {
        const correlationId = randomUUID();
        logAuthUnavailable({
          correlationId,
          operationId: operation.route.operationId,
        });
        return refusal(
          "internal_error",
          "Authentication service unavailable.",
          503,
          { correlationId },
        );
      }
      return access.kind === "forbidden"
        ? refusal("forbidden", "The actor lacks the required capability.", 403)
        : refusal("unauthorized", "Authentication is required.", 401);
    }
    actorSession = access.session;
    if (actorSession) {
      const byPerson = await getRateLimitGate().byPerson({
        method: request.method,
        operationId: operation.route.operationId,
        userId: actorSession.userId,
      });
      if (byPerson !== null) return tooManyRequests(byPerson);
    }
  }
  const rawInput = await readRequestInput(request, operation.input);
  return executeNextOperation(operation, request, rawInput, actorSession);
}

export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
