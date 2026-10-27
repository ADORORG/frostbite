import {
  correlationHeaderName,
  correlationIdSchema,
  httpErrorEnvelopeSchema,
  idempotencyHeaderName,
  idempotencyKeySchema,
  type CorrelationId,
  type ApplicationHttpErrorCode,
  type HttpErrorCode,
  type HttpErrorEnvelope,
  type HttpMethod,
  type IdempotencyKey,
  type IdempotencyPolicy,
} from "@ador/shared/http";
import type { z } from "zod";
import type { PageAccessRequirement } from "@ador/shared/features";
import type { UuidV7 } from "@ador/shared/identifiers";

export interface HttpOperationContext {
  readonly actorSession: HttpAuthenticatedSession | null;
  readonly actorUserId: UuidV7 | null;
  readonly correlationId: CorrelationId;
  readonly idempotencyKey?: IdempotencyKey;
}

export interface HttpAuthenticatedSession {
  readonly absoluteExpiresAt: Date;
  readonly authenticatedAt: Date;
  readonly idleExpiresAt: Date;
  readonly sessionId: UuidV7;
  readonly userId: UuidV7;
}

export type HttpResponseEffect =
  | {
      readonly kind: "replace-platform-session";
      readonly token: string;
    }
  // Signs the browser out: the platform session cookie is removed.
  | { readonly kind: "clear-platform-session" };

export type HttpOperationResult<Output extends object> =
  | {
      readonly effects?: readonly HttpResponseEffect[];
      readonly ok: true;
      readonly value: Output;
    }
  | {
      readonly error: ApplicationHttpErrorCode;
      readonly message: string;
      readonly ok: false;
      // Why, for a page that must tell apart failures sharing a code (see `httpErrorReasonSchema`).
      readonly reason?: string;
    };

export interface HttpOperation<Input, Output extends object> {
  readonly access: PageAccessRequirement;
  readonly applicationErrors: readonly ApplicationHttpErrorCode[];
  readonly execute: (
    input: Input,
    context: HttpOperationContext,
  ) => Promise<HttpOperationResult<Output>>;
  readonly idempotency: IdempotencyPolicy;
  // How the input arrives: in a JSON body, in the query string of a GET (`query`; a read that asks for something particular), or not
  // at all.
  readonly input: "json" | "none" | "query";
  readonly inputSchema: z.ZodType<Input>;
  readonly method: HttpMethod;
  readonly operationId: string;
  readonly outputSchema: z.ZodType<Output>;
  readonly path: `/api/v1/${string}`;
}

export interface HttpAdapterRequest {
  readonly actorSession: HttpAuthenticatedSession | null;
  readonly actorUserId: UuidV7 | null;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  /** Untrusted adapter input is validated immediately by the operation schema. */
  readonly rawInput: unknown;
}

export interface HttpAdapterResponse<Output extends object> {
  readonly body: Output | HttpErrorEnvelope;
  readonly effects: readonly HttpResponseEffect[];
  readonly headers: Readonly<
    Record<typeof correlationHeaderName, CorrelationId>
  >;
  readonly status: number;
}

// Why a request was answered with an internal error. Nothing here reaches the caller; it is for the operator.
export type InternalErrorReport = {
  readonly correlationId: CorrelationId;
  readonly operationId: string;
} &
  // The operation threw.
  (
    | { readonly kind: "exception"; readonly error: unknown }
    // The operation answered with an application error its declaration does not list.
    | { readonly kind: "undeclared-error"; readonly code: string }
    // The operation's answer did not match its output contract.
    | { readonly kind: "invalid-output" }
  );

export interface HttpExecutionDependencies {
  readonly createCorrelationId: () => string;
  // Told of every internal error, so a 500 can be found by its correlation id. Optional; a failure of its own is ignored.
  readonly report?: (report: InternalErrorReport) => void;
}

const errorStatuses: Readonly<Record<HttpErrorCode, number>> = {
  conflict: 409,
  forbidden: 403,
  idempotency_key_required: 400,
  internal_error: 500,
  invalid_request: 400,
  method_not_allowed: 405,
  not_found: 404,
  rate_limited: 429,
  unauthorized: 401,
};

function errorResponse<Output extends object>(
  code: HttpErrorCode,
  message: string,
  correlationId: CorrelationId,
  reason?: string,
): HttpAdapterResponse<Output> {
  const publicMessage =
    code === "internal_error" ? "Internal server error." : message;
  return {
    body: httpErrorEnvelopeSchema.parse({
      error: {
        code,
        correlationId,
        message: publicMessage,
        // An internal error says nothing of why.
        ...(reason === undefined || code === "internal_error"
          ? {}
          : { reason }),
      },
    }),
    effects: [],
    headers: { [correlationHeaderName]: correlationId },
    status: errorStatuses[code],
  };
}

export async function executeHttpOperation<Input, Output extends object>(
  operation: HttpOperation<Input, Output>,
  request: HttpAdapterRequest,
  dependencies: HttpExecutionDependencies,
): Promise<HttpAdapterResponse<Output>> {
  const generatedCorrelationId = correlationIdSchema.parse(
    dependencies.createCorrelationId(),
  );
  const correlationResult = correlationIdSchema.safeParse(
    request.headers[correlationHeaderName],
  );
  const correlationId = correlationResult.success
    ? correlationResult.data
    : generatedCorrelationId;

  if (
    request.headers[correlationHeaderName] !== undefined &&
    !correlationResult.success
  ) {
    return errorResponse(
      "invalid_request",
      "Invalid correlation ID.",
      correlationId,
    );
  }
  if (request.method !== operation.method) {
    return errorResponse(
      "method_not_allowed",
      "Method not allowed.",
      correlationId,
    );
  }

  const suppliedIdempotencyKey = request.headers[idempotencyHeaderName];
  const idempotencyResult = idempotencyKeySchema.safeParse(
    suppliedIdempotencyKey,
  );
  if (
    operation.idempotency === "required" &&
    suppliedIdempotencyKey === undefined
  ) {
    return errorResponse(
      "idempotency_key_required",
      "A valid idempotency key is required.",
      correlationId,
    );
  }
  if (suppliedIdempotencyKey !== undefined && !idempotencyResult.success) {
    return errorResponse(
      "invalid_request",
      "Invalid idempotency key.",
      correlationId,
    );
  }

  const inputResult = operation.inputSchema.safeParse(request.rawInput);
  if (!inputResult.success) {
    return errorResponse("invalid_request", "Invalid request.", correlationId);
  }

  const internal = (
    detail:
      | { readonly kind: "exception"; readonly error: unknown }
      | { readonly kind: "undeclared-error"; readonly code: string }
      | { readonly kind: "invalid-output" },
  ): HttpAdapterResponse<Output> => {
    try {
      dependencies.report?.({
        ...detail,
        correlationId,
        operationId: operation.operationId,
      });
    } catch {
      // Reporting must never change the answer.
    }
    return errorResponse(
      "internal_error",
      "Internal server error.",
      correlationId,
    );
  };
  try {
    const result = await operation.execute(inputResult.data, {
      actorUserId: request.actorUserId,
      actorSession: request.actorSession,
      correlationId,
      ...(idempotencyResult.success
        ? { idempotencyKey: idempotencyResult.data }
        : {}),
    });
    if (!result.ok) {
      if (!operation.applicationErrors.includes(result.error))
        return internal({ code: result.error, kind: "undeclared-error" });
      return errorResponse(
        result.error,
        result.message,
        correlationId,
        result.reason,
      );
    }
    const outputResult = operation.outputSchema.safeParse(result.value);
    return outputResult.success
      ? {
          body: outputResult.data,
          effects: result.effects ?? [],
          headers: { [correlationHeaderName]: correlationId },
          status: 200,
        }
      : internal({ kind: "invalid-output" });
  } catch (error) {
    return internal({ error, kind: "exception" });
  }
}
