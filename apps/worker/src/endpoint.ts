import type { AssetPipelineActivities } from "@ador/jobs/activities";
import type { WorkflowPolicy } from "@ador/jobs/policy";
import type {
  SignedWorkflowEndpoint,
  WorkflowEndpointFactory,
} from "@ador/jobs/provider-service";

// Builds the signed endpoint once from provider-neutral parts: the workflow provider's factory, the
// application's activities, and the workflow policy. Nothing here knows which workflow provider is
// registered. A failed build (missing configuration, unavailable provider) is not cached, so a later
// request can succeed.
export function createSignedEndpointResolver(dependencies: {
  readonly activities: () => Promise<AssetPipelineActivities>;
  readonly factory: () => Promise<WorkflowEndpointFactory>;
  readonly policy: WorkflowPolicy;
}): () => Promise<SignedWorkflowEndpoint> {
  let endpoint: Promise<SignedWorkflowEndpoint> | undefined;
  return () => {
    endpoint ??= Promise.all([
      dependencies.factory(),
      dependencies.activities(),
    ])
      .then(([factory, activities]) =>
        factory.createEndpoint({ activities, policy: dependencies.policy }),
      )
      .catch((error: Error) => {
        endpoint = undefined;
        throw error;
      });
    return endpoint;
  };
}
