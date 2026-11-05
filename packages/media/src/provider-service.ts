import type { ProviderServices } from "@frostbite/plugin-kit/providers";

import type { ImageProcessor } from "./processing.ts";

declare module "@frostbite/plugin-kit/providers" {
  interface ProviderServices {
    readonly "media-processing:image-derivatives": ImageProcessor;
  }
}

export type MediaProcessingProviderServices = Pick<
  ProviderServices,
  "media-processing:image-derivatives"
>;
