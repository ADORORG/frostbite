import { correlationIdSchema } from "@frostbite/shared/http";
import { z } from "zod";

export const eventIdSchema = z.uuid();
export const eventIdentifierMaxLength = 256;
export const eventNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+\.v[1-9][0-9]*$/);
export const eventPayloadSchema = z
  .record(
    z.string().regex(/^[a-z][A-Za-z0-9]*Id$/),
    z.string().min(1).max(eventIdentifierMaxLength),
  )
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Event payload must contain at least one identifier.",
  });

export const domainEventEnvelopeSchema = z
  .object({
    causationId: eventIdSchema.nullable(),
    correlationId: correlationIdSchema,
    eventId: eventIdSchema,
    name: eventNameSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    payload: eventPayloadSchema,
    schemaVersion: z.number().int().positive(),
  })
  .strict()
  .refine(({ name, schemaVersion }) => name.endsWith(`.v${schemaVersion}`), {
    message: "Event name version must match schemaVersion.",
    path: ["schemaVersion"],
  });

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;
