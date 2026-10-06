import type { ProviderServices } from "@ador/plugin-kit/providers";

import type { ImageProcessor } from "./processing.ts";

declare module "@ador/plugin-kit/providers" {
  interface ProviderServices {
    readonly "media-processing:image-derivatives": ImageProcessor;
  }
}

export type MediaProcessingProviderServices = Pick<
  ProviderServices,
  "media-processing:image-derivatives"
>;
