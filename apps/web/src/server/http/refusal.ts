import { randomUUID } from "node:crypto";

import {
  correlationHeaderName,
  httpErrorEnvelopeSchema,
  type HttpErrorCode,
} from "@ador/shared/http";

interface RefusalOptions {
  // When the cause is logged under the same id the caller is given.
  readonly correlationId?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

// An answer the platform gives before an operation runs (no such route, wrong origin, not signed in, too many requests). It is never
// kept: a cache that held a 401 or a 404 would show it to the next person, or after the reason for it had passed.
export function refusal(
  code: HttpErrorCode,
  message: string,
  status: number,
  { correlationId = randomUUID(), headers = {} }: RefusalOptions = {},
): Response {
  return Response.json(
    httpErrorEnvelopeSchema.parse({
      error: { code, correlationId, message },
    }),
    {
      headers: {
        ...headers,
        "cache-control": "no-store",
        [correlationHeaderName]: correlationId,
      },
      status,
    },
  );
}
