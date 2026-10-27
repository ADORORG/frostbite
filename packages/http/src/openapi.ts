import {
  correlationHeaderName,
  correlationIdSchema,
  httpErrorEnvelopeSchema,
  idempotencyHeaderName,
  idempotencyKeySchema,
  type ApplicationHttpErrorCode,
  type HttpMethod,
} from "@ador/shared/http";
import { z } from "zod";

import type { HttpOperation } from "./operation.js";
import { platformSessionCookieName } from "@ador/shared/auth";

type JsonSchema = z.core.JSONSchema.JSONSchema;
type OpenApiMethod = "delete" | "get" | "patch" | "post" | "put";

interface OpenApiResponse {
  readonly content: Readonly<Record<string, { readonly schema: JsonSchema }>>;
  readonly description: string;
  readonly headers?: Readonly<Record<string, { readonly schema: JsonSchema }>>;
}

interface OpenApiOperationObject {
  readonly operationId: string;
  readonly parameters: readonly object[];
  readonly requestBody?: {
    readonly content: {
      readonly "application/json": { readonly schema: JsonSchema };
    };
    readonly required: true;
  };
  readonly responses: Readonly<Record<string, OpenApiResponse>>;
  readonly security: readonly Readonly<Record<string, readonly string[]>>[];
}

type OpenApiPathItem = Partial<
  Readonly<Record<OpenApiMethod, OpenApiOperationObject>>
>;

export interface OpenApiDocument {
  readonly components: {
    readonly securitySchemes: Readonly<
      Record<
        "cookieSession",
        {
          readonly in: "cookie";
          readonly name: string;
          readonly type: "apiKey";
        }
      >
    >;
  };
  readonly info: { readonly title: string; readonly version: string };
  readonly openapi: "3.1.0";
  readonly paths: Readonly<Record<string, OpenApiPathItem>>;
}

export const openApiDocumentRoute = Object.freeze({
  method: "GET",
  operationId: "getOpenApiDocument",
  path: "/api/v1/openapi",
} as const);

function methodKey(method: HttpMethod): OpenApiMethod {
  switch (method) {
    case "DELETE":
      return "delete";
    case "GET":
      return "get";
    case "PATCH":
      return "patch";
    case "POST":
      return "post";
    case "PUT":
      return "put";
  }
}

const errorDescriptions: Readonly<Record<ApplicationHttpErrorCode, string>> = {
  conflict: "The request conflicts with current state.",
  forbidden: "The actor lacks the required capability.",
  invalid_request: "The request is invalid.",
  not_found: "The requested resource does not exist.",
  unauthorized: "Authentication is required or invalid.",
};

const errorStatuses: Readonly<Record<ApplicationHttpErrorCode, string>> = {
  conflict: "409",
  forbidden: "403",
  invalid_request: "400",
  not_found: "404",
  unauthorized: "401",
};

function jsonResponse(
  description: string,
  schema: JsonSchema,
): OpenApiResponse {
  return {
    content: { "application/json": { schema } },
    description,
  };
}

// A file operation's answer: each kind of file it may send, as bytes.
function fileResponse(
  description: string,
  contentTypes: readonly string[],
): OpenApiResponse {
  return {
    content: Object.fromEntries(
      contentTypes.map((type) => [
        type,
        { schema: { format: "binary", type: "string" } },
      ]),
    ),
    description,
  };
}

function jsonRequestBody(
  schema: JsonSchema,
): NonNullable<OpenApiOperationObject["requestBody"]> {
  return {
    content: { "application/json": { schema } },
    required: true,
  };
}

// A read's query string as OpenAPI parameters: one per field of its input, required where the input says so.
function queryParameters(schema: JsonSchema): readonly object[] {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    in: "query",
    name,
    required: required.has(name),
    schema: property,
  }));
}

export function describeOpenApiOperation<Input, Output extends object>(
  operation: HttpOperation<Input, Output>,
) {
  const errorSchema = z.toJSONSchema(httpErrorEnvelopeSchema);
  const responses: Record<string, OpenApiResponse> = {
    "200": {
      ...(operation.files === undefined
        ? jsonResponse(
            "Successful response.",
            z.toJSONSchema(operation.outputSchema),
          )
        : fileResponse("Successful response.", operation.files)),
      headers: {
        [correlationHeaderName]: {
          schema: z.toJSONSchema(correlationIdSchema),
        },
      },
    },
    "400": jsonResponse(
      "The request boundary rejected the input.",
      errorSchema,
    ),
    "405": jsonResponse("The HTTP method is not allowed.", errorSchema),
    "500": jsonResponse("An internal error occurred.", errorSchema),
  };

  for (const code of operation.applicationErrors) {
    const status = errorStatuses[code];
    responses[status] ??= jsonResponse(errorDescriptions[code], errorSchema);
  }

  const parameters: object[] = [
    {
      in: "header",
      name: correlationHeaderName,
      required: false,
      schema: z.toJSONSchema(correlationIdSchema),
    },
  ];
  if (operation.idempotency === "required") {
    parameters.push({
      in: "header",
      name: idempotencyHeaderName,
      required: true,
      schema: z.toJSONSchema(idempotencyKeySchema),
    });
  }

  if (operation.input === "query")
    parameters.push(...queryParameters(z.toJSONSchema(operation.inputSchema)));

  return {
    method: methodKey(operation.method),
    operation: {
      operationId: operation.operationId,
      parameters,
      security:
        operation.access.kind === "public" ? [] : [{ cookieSession: [] }],
      ...(operation.input === "json"
        ? {
            requestBody: jsonRequestBody(z.toJSONSchema(operation.inputSchema)),
          }
        : {}),
      responses,
    },
    path: operation.path,
  };
}

export type OpenApiOperationDescription = ReturnType<
  typeof describeOpenApiOperation
>;

export function createOpenApiDocument(input: {
  readonly operations: readonly OpenApiOperationDescription[];
  readonly title: string;
  readonly version: string;
}): OpenApiDocument {
  const paths: Record<string, OpenApiPathItem> = {};
  for (const description of input.operations) {
    const pathItem = paths[description.path] ?? {};
    if (pathItem[description.method]) {
      throw new Error(
        `Duplicate OpenAPI operation: ${description.method.toUpperCase()} ${description.path}.`,
      );
    }
    paths[description.path] = {
      ...pathItem,
      [description.method]: description.operation,
    };
  }
  return {
    components: {
      securitySchemes: {
        cookieSession: {
          in: "cookie",
          name: platformSessionCookieName,
          type: "apiKey",
        },
      },
    },
    info: { title: input.title, version: input.version },
    openapi: "3.1.0",
    paths,
  };
}
