import { defineFeature } from "@ador/plugin-kit";
import { creatorApplicationRoutes } from "@ador/shared/creator-admission";

export const creatorAdmissionFeature = defineFeature({
  manifest: {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    dependencies: ["accounts"],
    navigation: [
      {
        access: { kind: "authenticated" },
        area: "studio",
        href: "/studio/creator-application",
        label: "Creator application",
        order: 30,
      },
      {
        access: { capability: "creator:review", kind: "platform" },
        area: "admin",
        href: "/admin/creator-applications",
        label: "Creator reviews",
        order: 20,
      },
    ],
    id: "creator-admission",
    pages: [
      {
        access: { kind: "authenticated" },
        path: "/studio/creator-application",
      },
      {
        access: { capability: "creator:review", kind: "platform" },
        path: "/admin/creator-applications",
      },
    ],
    requiredDecisionGates: [],
    requiredProviderCapabilities: [],
    routes: Object.values(creatorApplicationRoutes),
    version: "1.0.0",
  },
  load: async () =>
    import("@ador/feature-creator-admission/entrypoint").then(
      ({ createCreatorAdmissionEntrypoint }) =>
        createCreatorAdmissionEntrypoint(),
    ),
});
