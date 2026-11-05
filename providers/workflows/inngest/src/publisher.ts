import type { DomainEventEnvelope } from "@frostbite/events";
import {
  TerminalWorkflowDeliveryError,
  type WorkflowEventPublisher,
} from "@frostbite/jobs";

// The one capability the publisher needs; the SDK client satisfies it.
export interface EventSender {
  send(event: {
    readonly data: Record<string, unknown>;
    readonly id: string;
    readonly name: string;
  }): Promise<unknown>;
}

const apiErrorStatus = /^Inngest API Error: (\d{3})\b/;
// Statuses that mean this exact event can never be accepted. Anything else (credentials an operator
// can fix, rate limits, outages, network errors) is retried by the relay with bounded backoff.
const terminalStatuses = new Set([400, 413, 422]);

// The event id is the idempotency key: Inngest drops a second event with the same id, so a relay
// that re-publishes after a lost acknowledgement cannot start a second run.
export function createInngestEventPublisher(
  client: EventSender,
): WorkflowEventPublisher {
  return {
    async publish(event: DomainEventEnvelope): Promise<void> {
      try {
        await client.send({
          data: {
            causationId: event.causationId,
            correlationId: event.correlationId,
            occurredAt: event.occurredAt,
            payload: event.payload,
            schemaVersion: event.schemaVersion,
          },
          id: event.eventId,
          name: event.name,
        });
      } catch (error) {
        const status = Number(
          apiErrorStatus.exec(error instanceof Error ? error.message : "")?.[1],
        );
        if (terminalStatuses.has(status))
          throw new TerminalWorkflowDeliveryError(
            `Event rejected with status ${status}.`,
          );
        throw error;
      }
    },
  };
}
