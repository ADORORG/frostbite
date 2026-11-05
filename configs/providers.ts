import { laserEyesProvider } from "@frostbite/wallet/registration";
import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import { r2ObjectStorageProvider } from "@frostbite/provider-object-storage-r2/registration";
import { sharpMediaProcessingProvider } from "@frostbite/provider-media-processing-sharp/registration";
import { inngestWorkflowProvider } from "@frostbite/provider-workflows-inngest/registration";

export const providerRegistry = createProviderRegistry([
  laserEyesProvider,
  r2ObjectStorageProvider,
  sharpMediaProcessingProvider,
  inngestWorkflowProvider,
]);
