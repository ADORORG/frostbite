import { assetProcessingRequestedEvent } from "@ador/shared/uploads";
import { eventType } from "inngest";
import { z } from "zod";

// What the publisher sends: the envelope's identity and metadata around its identifier-only payload.
export const workflowEventDataSchema = z.object({
  causationId: z.string().nullable(),
  correlationId: z.string(),
  occurredAt: z.string(),
  payload: z.record(z.string(), z.string()),
  schemaVersion: z.number().int().positive(),
});

export const assetProcessingRequested = eventType(
  assetProcessingRequestedEvent.name,
  {
    schema: workflowEventDataSchema.extend({
      payload: z.object({
        assetId: z.string().min(1),
        uploadIntentId: z.string().min(1),
      }),
    }),
  },
);
