import { defineFeature } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import {
  libraryRoute,
  uploadDetailPath,
  uploadIntentRoutes,
  uploadsNewPath,
  uploadsNavigationLabel,
  uploadsStudioPath,
} from "@ador/shared/uploads";

export function createUploadsFeature(providers: ProviderRegistry) {
  return defineFeature({
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
          href: uploadsStudioPath,
          label: uploadsNavigationLabel,
          order: 20,
        },
      ],
      id: "uploads",
      pages: [
        { access: { kind: "authenticated" }, path: uploadsStudioPath },
        { access: { kind: "authenticated" }, path: uploadsNewPath },
        { access: { kind: "authenticated" }, path: uploadDetailPath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes: [
        libraryRoute,
        uploadIntentRoutes.complete,
        uploadIntentRoutes.create,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-uploads/entrypoint").then(
        ({ createUploadsEntrypoint }) => createUploadsEntrypoint(providers),
      ),
  });
}
