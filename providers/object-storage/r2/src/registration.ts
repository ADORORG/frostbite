import { defineProvider } from "@frostbite/plugin-kit/providers";
import { r2ObjectStorageProviderId } from "./identity.ts";

export const r2ObjectStorageProvider = defineProvider({
  manifest: {
    capabilities: ["object-storage:s3-compatible"],
    id: r2ObjectStorageProviderId,
    requiredDecisionGates: [],
    version: "1.0.0",
  },
  load: async () =>
    import("./provider-entrypoint.ts").then(
      ({ createR2ObjectStorageProviderEntrypoint }) =>
        createR2ObjectStorageProviderEntrypoint(process.env),
    ),
});
