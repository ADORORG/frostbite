import { defineProvider } from "@frostbite/plugin-kit/providers";

export const laserEyesProvider = defineProvider({
  manifest: {
    capabilities: ["wallet:connect", "wallet:message-sign", "wallet:psbt-sign"],
    id: "lasereyes",
    requiredDecisionGates: [],
    version: "1.0.0",
  },
  load: async () =>
    import("./provider-entrypoint.ts").then(
      ({ laserEyesProviderEntrypoint }) => laserEyesProviderEntrypoint,
    ),
});
