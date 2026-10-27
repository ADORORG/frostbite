import type { RouteContribution } from "@ador/shared/features";
import type { PageAccessRequirement } from "@ador/shared/features";

import {
  executeHttpOperation,
  type HttpAdapterRequest,
  type HttpAdapterResponse,
  type HttpExecutionDependencies,
  type HttpOperation,
} from "./operation.ts";
import { describeOpenApiOperation } from "./openapi.ts";

export type OpenApiOperationDescription = ReturnType<
  typeof describeOpenApiOperation
>;

export interface RegisteredHttpOperation {
  readonly access: PageAccessRequirement;
  readonly input: HttpOperation<object, object>["input"];
  readonly describe: () => OpenApiOperationDescription;
  readonly execute: (
    request: HttpAdapterRequest,
    dependencies: HttpExecutionDependencies,
  ) => Promise<HttpAdapterResponse<object>>;
  readonly route: RouteContribution;
}

export function registerHttpOperation<Input, Output extends object>(
  operation: HttpOperation<Input, Output>,
): RegisteredHttpOperation {
  // A query string is only read from a GET; an operation that declared one elsewhere would never be given its input.
  if (operation.input === "query" && operation.method !== "GET")
    throw new Error(
      `Operation ${operation.operationId} reads a query string, so it must be a GET.`,
    );
  return Object.freeze({
    access: operation.access,
    input: operation.input,
    describe: () => describeOpenApiOperation(operation),
    execute: (
      request: HttpAdapterRequest,
      dependencies: HttpExecutionDependencies,
    ) => executeHttpOperation(operation, request, dependencies),
    route: Object.freeze({
      method: operation.method,
      operationId: operation.operationId,
      path: operation.path,
    }),
  });
}
