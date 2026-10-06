import type {
  SignedWorkflowEndpoint,
  WorkflowEndpointFactory,
} from "@ador/jobs/provider-service";
import { serve } from "inngest/edge";
import type { Inngest } from "inngest";

import { createAssetPipelineFunction } from "./asset-pipeline-function.ts";

// The SDK verifies Inngest's request signature with the client's signing key before any function
// runs, so an unsigned or forged request never reaches an activity.
export function createInngestEndpointFactory(
  client: Inngest,
): WorkflowEndpointFactory {
  return {
    createEndpoint({ activities, policy }): SignedWorkflowEndpoint {
      return serve({
        client,
        functions: [
          createAssetPipelineFunction(client, { activities, policy }),
        ],
      });
    },
  };
}
