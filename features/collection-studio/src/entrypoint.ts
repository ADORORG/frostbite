import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";

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
import { createCollectionStudioContextResolver } from "./context.ts";
import {
  createAssetPreviewResolver,
  createCollectionServiceResolver,
} from "./runtime.ts";

export function createCollectionStudioEntrypoint(
  providers: ProviderRegistry,
  targetChains: readonly ChainOption[],
): FeatureEntrypoint {
  const context = createCollectionStudioContextResolver(providers);
  const getService = createCollectionServiceResolver(context, targetChains);
  const dependencies = {
    getPreviews: createAssetPreviewResolver(context),
    getService,
  };
  return {
    capabilities: ["api-routes"],
    id: "collection-studio",
    operations: [
      registerHttpOperation(createAddItemOperation(getService)),
      registerHttpOperation(createCreateDraftOperation(dependencies)),
      registerHttpOperation(createListDraftsOperation(dependencies)),
      registerHttpOperation(createReadDraftOperation(dependencies)),
      registerHttpOperation(createRemoveItemOperation(getService)),
      registerHttpOperation(createSaveDraftOperation(dependencies)),
      registerHttpOperation(createUpdateItemOperation(getService)),
    ],
    version: "1.0.0",
  };
}
