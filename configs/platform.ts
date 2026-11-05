import { validatePlatformBoot } from "@frostbite/plugin-kit/boot";
import { openApiDocumentRoute } from "@frostbite/http/openapi";

import { decisionCatalog } from "./decision-gates";
import { featureRegistry } from "./features";
import { providerRegistry } from "./providers";

const platformBoot = validatePlatformBoot({
  decisionCatalog,
  featureRegistry,
  providerRegistry,
  reservedRoutes: [openApiDocumentRoute],
});

export const platformComposition = Object.freeze({
  boot: platformBoot,
  features: featureRegistry,
  providers: providerRegistry,
});
