import type { RouteContribution } from "@ador/shared/features";
import type { PageAccessRequirement } from "@ador/shared/features";

import { assertCachePolicy, type HttpCachePolicy } from "./cache.ts";
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
  readonly cache: HttpCachePolicy | undefined;
  readonly file: boolean;
  readonly input: HttpOperation<object, object>["input"];
  readonly describe: () => OpenApiOperationDescription;
  readonly execute: (
    request: HttpAdapterRequest,
    dependencies: HttpExecutionDependencies,
  ) => Promise<HttpAdapterResponse<object>>;
  readonly route: RouteContribution;
}

// The first word of an operation id that says it only reads. An id is a verb and what it acts on (`listUploads`, `getMintedPicture`).
const readVerbs =
  /^(?:check|describe|fetch|find|get|list|load|read|search)(?=[A-Z])/u;

export const isNamedLikeARead = (operationId: string): boolean =>
  readVerbs.test(operationId);

export function registerHttpOperation<Input, Output extends object>(
  operation: HttpOperation<Input, Output>,
): RegisteredHttpOperation {
  // A query string is only read from a GET; an operation that declared one elsewhere would never be given its input.
  if (operation.input === "query" && operation.method !== "GET")
    throw new Error(
      `Operation ${operation.operationId} reads a query string, so it must be a GET.`,
    );
  // Every read says how it is kept; nothing else may (a write's answer is never kept).
  if ((operation.method === "GET") !== (operation.cache !== undefined))
    throw new Error(
      `Operation ${operation.operationId}: a GET states its cache policy, and nothing else does.`,
    );
  if (operation.cache !== undefined) assertCachePolicy(operation.cache);
  // A read is a GET. The one reason it is not is stated, and nothing else states one.
  const reason = operation.readsAsPost;
  const namedAsRead = isNamedLikeARead(operation.operationId);
  if (operation.method !== "GET" && namedAsRead && reason === undefined)
    throw new Error(
      `Operation ${operation.operationId} is named like a read, so it is a GET or states \`readsAsPost\`.`,
    );
  if (reason !== undefined && (operation.method === "GET" || !namedAsRead))
    throw new Error(
      `Operation ${operation.operationId} states \`readsAsPost\` but is not a read sent as a POST.`,
    );
  if (reason?.trim() === "")
    throw new Error(
      `Operation ${operation.operationId} states an empty reason in \`readsAsPost\`.`,
    );
  return Object.freeze({
    access: operation.access,
    cache: operation.cache,
    file: operation.files !== undefined,
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
