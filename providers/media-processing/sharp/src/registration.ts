import { defineProvider } from "@ador/plugin-kit/providers";

import { sharpMediaProcessingProviderId } from "./identity.ts";

export const sharpMediaProcessingProvider = defineProvider({
  manifest: {
    capabilities: ["media-processing:image-derivatives"],
    id: sharpMediaProcessingProviderId,
    requiredDecisionGates: [],
    version: "1.0.0",
  },
  load: async () =>
    import("./provider-entrypoint.ts").then(
      ({ createSharpMediaProcessingProviderEntrypoint }) =>
        createSharpMediaProcessingProviderEntrypoint(),
    ),
});
