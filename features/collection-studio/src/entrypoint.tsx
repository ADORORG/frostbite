import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";
import {
  collectionStudioPath,
  collectionWizardPath,
} from "@ador/shared/collections";

import {
  createCreateDraftOperation,
  createListDraftsOperation,
  createReadDraftOperation,
  createSaveDraftOperation,
} from "./application/draft-operations.ts";
import {
  createAddItemOperation,
  createRemoveItemOperation,
  createUpdateItemOperation,
} from "./application/item-operations.ts";
import {
  createListSubmissionsOperation,
  createSubmitCollectionOperation,
} from "./application/submission-operations.ts";
import { createCollectionStudioContextResolver } from "./context.ts";
import {
  createAssetPreviewResolver,
  createCollectionServiceResolver,
  createSubmissionServiceResolver,
} from "./runtime.ts";
import { CollectionsSurface } from "./ui/collections-surface.tsx";
import { WizardSurface } from "./ui/wizard-surface.tsx";

export function createCollectionStudioEntrypoint(
  providers: ProviderRegistry,
  targetChains: readonly ChainOption[],
): FeatureEntrypoint {
  const enabledChains = targetChains.filter(({ enabled }) => enabled);
  const context = createCollectionStudioContextResolver(providers);
  const getService = createCollectionServiceResolver(context, targetChains);
  const getSubmissions = createSubmissionServiceResolver(context, targetChains);
  const dependencies = {
    getPreviews: createAssetPreviewResolver(context),
    getService,
  };
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    id: "collection-studio",
    operations: [
      registerHttpOperation(createAddItemOperation(getService)),
      registerHttpOperation(createCreateDraftOperation(dependencies)),
      registerHttpOperation(createListDraftsOperation(dependencies)),
      registerHttpOperation(createListSubmissionsOperation(getSubmissions)),
      registerHttpOperation(createReadDraftOperation(dependencies)),
      registerHttpOperation(createRemoveItemOperation(getService)),
      registerHttpOperation(createSaveDraftOperation(dependencies)),
      registerHttpOperation(createSubmitCollectionOperation(getSubmissions)),
      registerHttpOperation(createUpdateItemOperation(getService)),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: collectionStudioPath,
        render: ({ navigation }) => (
          <CollectionsSurface
            navigation={navigation}
            targetChains={enabledChains}
          />
        ),
      },
      {
        access: { kind: "authenticated" },
        path: collectionWizardPath,
        render: ({ navigation, params }) => (
          <WizardSurface
            collectionId={params.collectionId ?? ""}
            navigation={navigation}
            targetChains={enabledChains}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
