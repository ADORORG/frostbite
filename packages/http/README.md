# `@ador/http`

Framework-neutral execution boundary for versioned HTTP operations.

Operations declare method, path, idempotency policy, runtime input/output schemas, and one typed
application handler. Delivery adapters supply untrusted input, selected normalized headers, and a
correlation-ID generator. The executor validates every boundary and emits the shared safe error
envelope without importing Next.js or Fastify.

`@ador/http/outcome` exports `failure` and `unauthenticated`, the one way an operation reports a
refusal, so features do not restate the result shape.

The `@ador/http/openapi` export derives an OpenAPI 3.1 document from those same operation schemas
and declarations. This keeps request, response, header, and application-error documentation tied to
the executable contract. The generated document contains no deployment domain or server URL.

`@ador/http/registered-operation` erases operation-specific generics only after a typed operation
is built. Registries can expose heterogeneous operations to Next.js today and a future Fastify
adapter without duplicating schemas, handlers, or route metadata.

The package owns no business logic, authentication policy, database access, or provider calls.
Adapters and feature operations are verified independently through conformance tests.

`@ador/http/node-adapter` adapts a fetch-style handler to a `node:http` request listener. It buffers the
request, runs the handler, and writes the response; a throwing handler yields a generic 500 and is
reported only through an optional hook, never to the client. A body over `defaultMaxBodyBytes` (1 MiB, overridable) is refused with 413 before it is buffered,
first from the declared length and otherwise as it streams. It is delivery plumbing for standalone
services such as the worker, with no framework dependency.
