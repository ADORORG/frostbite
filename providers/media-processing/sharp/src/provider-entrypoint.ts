import type { MediaProcessingProviderServices } from "@frostbite/media/processing";
import type { ProviderEntrypoint } from "@frostbite/plugin-kit/providers";
import { resolveDerivativePolicy } from "@frostbite/shared/uploads";

import { createSharpImageProcessor } from "./create-processor.ts";
import { sharpMediaProcessingProviderId } from "./identity.ts";

export function createSharpMediaProcessingProviderEntrypoint(): ProviderEntrypoint {
  return {
    capabilities: ["media-processing:image-derivatives"],
    createServices: (): MediaProcessingProviderServices => ({
      "media-processing:image-derivatives": createSharpImageProcessor(
        resolveDerivativePolicy(),
      ),
    }),
    id: sharpMediaProcessingProviderId,
    version: "1.0.0",
  };
}
