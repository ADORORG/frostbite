import type { MediaProcessingProviderServices } from "@ador/media/processing";
import type { ProviderEntrypoint } from "@ador/plugin-kit/providers";
import { resolveDerivativePolicy } from "@ador/shared/uploads";

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
