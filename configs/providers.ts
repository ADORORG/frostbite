import { laserEyesProvider } from "@ador/wallet/registration";
import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { r2ObjectStorageProvider } from "@ador/provider-object-storage-r2/registration";
import { sharpMediaProcessingProvider } from "@ador/provider-media-processing-sharp/registration";
import { inngestWorkflowProvider } from "@ador/provider-workflows-inngest/registration";

export const providerRegistry = createProviderRegistry([
  laserEyesProvider,
  r2ObjectStorageProvider,
  sharpMediaProcessingProvider,
  inngestWorkflowProvider,
]);
