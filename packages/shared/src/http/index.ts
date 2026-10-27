import { z } from "zod";

export const correlationHeaderName = "x-correlation-id";
export const idempotencyHeaderName = "idempotency-key";

export const correlationIdSchema = z.uuid();
export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._~-]+$/u);

export const httpErrorCodeSchema = z.enum([
  "conflict",
  "forbidden",
  "idempotency_key_required",
  "internal_error",
  "invalid_request",
  "method_not_allowed",
  "not_found",
  // The caller made too many requests for now; try again after the `Retry-After` seconds.
  "rate_limited",
  "unauthorized",
]);
// A stable, machine-readable name for why a request failed, for the failures a page must tell apart (which of several conflicts it was).
// The page chooses its words from the reason, never from the message, so rewording a message cannot change what the page does.
export const httpErrorReasonSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
  .max(64);
export const httpErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: httpErrorCodeSchema,
        correlationId: correlationIdSchema,
        message: z.string().min(1).max(256),
        reason: httpErrorReasonSchema.optional(),
      })
      .strict(),
  })
  .strict();

export const httpMethodSchema = z.enum([
  "DELETE",
  "GET",
  "PATCH",
  "POST",
  "PUT",
]);
export const idempotencyPolicySchema = z.enum(["none", "required"]);

export type CorrelationId = z.infer<typeof correlationIdSchema>;
export type ApplicationHttpErrorCode = Exclude<
  HttpErrorCode,
  | "idempotency_key_required"
  | "internal_error"
  | "method_not_allowed"
  | "rate_limited"
>;
export type HttpErrorCode = z.infer<typeof httpErrorCodeSchema>;
export type HttpErrorEnvelope = z.infer<typeof httpErrorEnvelopeSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
export type IdempotencyPolicy = z.infer<typeof idempotencyPolicySchema>;
export * from "./fingerprint.ts";
export * from "./rate-limit.ts";

// A list in a query string: values separated by commas (`states=a,b`), checked as the array schema `list` says (its items, its
// length). A query string carries text only and a name may be given once, so a list travels as one value. `queryList` writes it.
export const commaSeparated = <
  List extends z.ZodType<readonly string[], string[]>,
>(
  list: List,
) =>
  z
    .string()
    .min(1)
    .transform((text) => text.split(","))
    .pipe(list);
export const queryList = (values: readonly string[]): string =>
  values.join(",");
