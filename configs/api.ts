import { createOpenApiDocument } from "@frostbite/http/openapi";
import type { RegisteredHttpOperation } from "@frostbite/http/registered-operation";
import { platformApiInfo } from "@frostbite/shared/platform";

import { platformComposition } from "./platform";

async function operations(): Promise<readonly RegisteredHttpOperation[]> {
  const entrypoints = await platformComposition.features.loadAll();
  return entrypoints.flatMap(({ operations: contributed = [] }) => contributed);
}

export async function resolveApiOperation(
  method: string,
  path: string,
): Promise<RegisteredHttpOperation | undefined> {
  const registered = await operations();
  return (
    registered.find(
      ({ route }) => route.method === method && route.path === path,
    ) ?? registered.find(({ route }) => route.path === path)
  );
}

export async function getOpenApiDocument() {
  return createOpenApiDocument({
    ...platformApiInfo,
    operations: (await operations()).map(({ describe }) => describe()),
  });
}
