import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

import { createUploadIntentOperation } from "./application/operation.ts";
import { createCompleteUploadIntentOperation } from "./application/completion-operation.ts";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { createUploadsContextResolver } from "./context.ts";
import { UploadsSurface } from "./ui/uploads-surface.tsx";
import { createListUploadedAssetsOperation } from "./application/library-operation.ts";
import { createLibraryServiceResolver } from "./library-runtime.ts";
import { createUploadServiceResolver } from "./runtime.ts";

export function createUploadsEntrypoint(
  providers: ProviderRegistry,
): FeatureEntrypoint {
  const context = createUploadsContextResolver(providers);
  const resolveService = createUploadServiceResolver(context);
  const resolveLibrary = createLibraryServiceResolver(context);
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    id: "uploads",
    operations: [
      registerHttpOperation(
        createCompleteUploadIntentOperation(resolveService),
      ),
      registerHttpOperation(createListUploadedAssetsOperation(resolveLibrary)),
      registerHttpOperation(createUploadIntentOperation(resolveService)),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: uploadsStudioPath,
        render: ({ navigation }) => <UploadsSurface navigation={navigation} />,
      },
    ],
    version: "1.0.0",
  };
}
