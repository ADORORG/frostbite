import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

import { createUploadIntentOperation } from "./application/operation.ts";
import { createCompleteUploadIntentOperation } from "./application/completion-operation.ts";
import {
  uploadDetailPath,
  uploadsNewPath,
  uploadsStudioPath,
} from "@ador/shared/uploads";
import { createUploadsContextResolver } from "./context.ts";
import { ImageDetailSurface } from "./ui/image-detail-surface.tsx";
import { NewUploadSurface } from "./ui/new-upload-surface.tsx";
import { UploadsSurface } from "./ui/uploads-surface.tsx";
import {
  createListOlderUploadedAssetsOperation,
  createListUploadedAssetsOperation,
} from "./application/library-operation.ts";
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
      registerHttpOperation(
        createListOlderUploadedAssetsOperation(resolveLibrary),
      ),
      registerHttpOperation(createUploadIntentOperation(resolveService)),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: uploadsStudioPath,
        render: ({ navigation }) => <UploadsSurface navigation={navigation} />,
      },
      {
        access: { kind: "authenticated" },
        path: uploadsNewPath,
        render: ({ navigation }) => (
          <NewUploadSurface navigation={navigation} />
        ),
      },
      {
        access: { kind: "authenticated" },
        path: uploadDetailPath,
        render: ({ navigation, params }) => (
          <ImageDetailSurface
            // The registry matches this page only with its segment, so the parameter is always present.
            assetId={params.assetId ?? ""}
            navigation={navigation}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
