import type { ProviderServices } from "@ador/plugin-kit/providers";

import type { WorkflowEventPublisher } from "./outbox-relay.ts";
import type { AssetPipelineActivities } from "./pipeline-activities.ts";
import type { WorkflowPolicy } from "./workflow-policy.ts";

// Verifies the workflow provider's signature, runs the registered workflows, and answers.
export type SignedWorkflowEndpoint = (request: Request) => Promise<Response>;

export interface WorkflowEndpointFactory {
  createEndpoint(input: {
    readonly activities: AssetPipelineActivities;
    readonly policy: WorkflowPolicy;
  }): SignedWorkflowEndpoint;
}

declare module "@ador/plugin-kit/providers" {
  interface ProviderServices {
    readonly "workflow-orchestration:event-publisher": WorkflowEventPublisher;
    readonly "workflow-orchestration:signed-endpoint": WorkflowEndpointFactory;
  }
}

export type WorkflowProviderServices = Pick<
  ProviderServices,
  | "workflow-orchestration:event-publisher"
  | "workflow-orchestration:signed-endpoint"
>;
