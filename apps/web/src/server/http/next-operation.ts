import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import type { RegisteredHttpOperation } from "@ador/http/registered-operation";
import {
  correlationHeaderName,
  idempotencyHeaderName,
} from "@ador/shared/http";
import { platformSessionCookieName } from "@ador/shared/auth";
import { parseAuthSessionEnvironment } from "@repo/config/env";
import type { ActiveSession } from "@ador/auth";

export async function executeNextOperation(
  operation: RegisteredHttpOperation,
  request: Request,
  rawInput: unknown,
  actorSession: ActiveSession | null,
): Promise<Response> {
  const response = await operation.execute(
    {
      actorSession,
      actorUserId: actorSession?.userId ?? null,
      headers: {
        [correlationHeaderName]:
          request.headers.get(correlationHeaderName) ?? undefined,
        [idempotencyHeaderName]:
          request.headers.get(idempotencyHeaderName) ?? undefined,
      },
      method: request.method,
      rawInput,
    },
    { createCorrelationId: randomUUID },
  );

  for (const effect of response.effects) {
    if (effect.kind === "clear-platform-session")
      (await cookies()).set(platformSessionCookieName, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: true,
      });
    if (effect.kind === "replace-platform-session") {
      const environment = parseAuthSessionEnvironment(process.env);
      (await cookies()).set(platformSessionCookieName, effect.token, {
        httpOnly: true,
        maxAge: Math.floor(environment.AUTH_SESSION_IDLE_TIMEOUT_MS / 1_000),
        path: "/",
        sameSite: "lax",
        secure: true,
      });
    }
  }

  return Response.json(response.body, {
    headers: response.headers,
    status: response.status,
  });
}
