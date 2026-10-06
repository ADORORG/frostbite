import type { WorkflowProviderServices } from "@ador/jobs/provider-service";
import type { ProviderEntrypoint } from "@ador/plugin-kit/providers";

import { createInngestClient } from "./client.ts";
import { parseInngestEnvironment } from "./config.ts";
import { createInngestEndpointFactory } from "./create-endpoint.ts";
import { inngestWorkflowProviderId } from "./identity.ts";
import { createInngestEventPublisher } from "./publisher.ts";

export function createInngestProviderEntrypoint(
  environment: NodeJS.ProcessEnv,
): ProviderEntrypoint {
  return {
    capabilities: [
      "workflow-orchestration:event-publisher",
      "workflow-orchestration:signed-endpoint",
    ],
    // Configuration is validated only when a service is first used (like the storage provider).
    createServices: (): WorkflowProviderServices => {
      const client = createInngestClient(parseInngestEnvironment(environment));
      return {
        "workflow-orchestration:event-publisher":
          createInngestEventPublisher(client),
        "workflow-orchestration:signed-endpoint":
          createInngestEndpointFactory(client),
      };
    },
    id: inngestWorkflowProviderId,
    version: "1.0.0",
  };
}
