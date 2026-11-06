import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type {
  FeatureEntrypoint,
  FeatureLoadContext,
} from "@frostbite/plugin-kit";

import { siteDescription, siteTagline } from "@frostbite/shared/platform";
import { createPlatformStatusOperation } from "./application/platform-status.ts";
import { drawSections } from "./application/draw-sections.ts";
import { PlatformHome } from "./ui/home.tsx";

export function createPlatformShellEntrypoint(
  context: FeatureLoadContext,
): FeatureEntrypoint {
  return {
    id: "platform-shell",
    sitemapPaths: () => ["/"],
    version: "1.0.0",
    capabilities: ["api-routes", "navigation", "public-page"],
    operations: [
      registerHttpOperation(
        createPlatformStatusOperation(context.registeredFeatureCount),
      ),
    ],
    pages: [
      {
        access: { kind: "public" },
        metadata: () => ({
          description: siteDescription,
          kind: "shared",
          title: siteTagline,
        }),
        path: "/",
        render: async ({ homeSections = [], navigation }) => (
          <PlatformHome
            navigation={navigation}
            registeredFeatureIds={context.registeredFeatureIds}
            sections={await drawSections(homeSections)}
          />
        ),
      },
    ],
  };
}
