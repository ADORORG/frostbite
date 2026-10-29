import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint, FeatureLoadContext } from "@ador/plugin-kit";

import { createPlatformStatusOperation } from "./application/platform-status.ts";
import { drawSections } from "./application/draw-sections.ts";
import { PlatformHome } from "./ui/home.tsx";

export function createPlatformShellEntrypoint(
  context: FeatureLoadContext,
): FeatureEntrypoint {
  return {
    id: "platform-shell",
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
