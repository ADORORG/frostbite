import { defineFeature } from "@frostbite/plugin-kit";
import { platformStatusRoute } from "@frostbite/shared/platform";

export const platformShellFeature = defineFeature({
  manifest: {
    id: "platform-shell",
    version: "1.0.0",
    capabilities: ["api-routes", "navigation", "public-page"],
    dependencies: [],
    navigation: [],
    requiredDecisionGates: [],
    requiredProviderCapabilities: [],
    pages: [{ access: { kind: "public" }, path: "/" }],
    routes: [platformStatusRoute],
  },
  load: async (context) =>
    import("@frostbite/feature-platform-shell/entrypoint").then(
      ({ createPlatformShellEntrypoint }) =>
        createPlatformShellEntrypoint(context),
    ),
});
