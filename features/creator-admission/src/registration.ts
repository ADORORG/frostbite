import { defineFeature } from "@ador/plugin-kit";
import {
  creatorApplicationPath,
  creatorApplicationRoutes,
  creatorReviewPath,
} from "@ador/shared/creator-admission";

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
        href: creatorApplicationPath,
        label: "Creator application",
        order: 30,
      },
      {
        access: { capability: "creator:review", kind: "platform" },
        area: "admin",
        href: creatorReviewPath,
        label: "Creator reviews",
        order: 20,
      },
    ],
    id: "creator-admission",
    pages: [
      {
        access: { kind: "authenticated" },
        path: creatorApplicationPath,
      },
      {
        access: { capability: "creator:review", kind: "platform" },
        path: creatorReviewPath,
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
