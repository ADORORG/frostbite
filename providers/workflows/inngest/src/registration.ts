import { defineProvider } from "@frostbite/plugin-kit/providers";

import { inngestWorkflowProviderId } from "./identity.ts";

export const inngestWorkflowProvider = defineProvider({
  manifest: {
    capabilities: [
      "workflow-orchestration:event-publisher",
      "workflow-orchestration:signed-endpoint",
    ],
    id: inngestWorkflowProviderId,
    requiredDecisionGates: [],
    version: "1.0.0",
  },
  load: async () =>
    import("./provider-entrypoint.ts").then(
      ({ createInngestProviderEntrypoint }) =>
        createInngestProviderEntrypoint(process.env),
    ),
});
