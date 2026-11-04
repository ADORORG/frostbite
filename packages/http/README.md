# `@ador/http`

Framework-neutral execution boundary for versioned HTTP operations.

Operations declare method, path, how their input arrives (`json` body, `query` string of a GET, or `none`), idempotency policy, runtime input/output schemas, and one typed
application handler. Delivery adapters supply untrusted input, selected normalized headers, and a
correlation-ID generator. The executor validates every boundary and emits the shared safe error
envelope without importing Next.js or Fastify.

`@ador/http/outcome` exports `failure`, the one way an operation reports a refusal, so features do not
restate the result shape, and the answers every operation gives the same way: `unauthenticated` (no
session), `idempotencyKeyConflict`, `invalidCursor` (a page cursor the list did not produce) and
`forbiddenMessage` (the words for a caller who lacks the capability, which the generated API documentation
uses too).

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

## Readiness and rate limits

`@ador/http/readiness` runs a service's probes (database, object storage) at once, each with its own time limit,
and says whether it can take traffic (`runReadiness`). A probe's failure reason goes to the service's log through
`onFailure` and never into the answer, which is public.

`@ador/http/rate-limit` holds the in-process limiter, `clientAddress` (the address a trusted proxy recorded, read
from the end of `X-Forwarded-For`), and `createRateLimitGate`: a check by network address before any other work,
and one by person after sign-in, each against a policy resolved per operation (`@ador/shared/http`). A limiter that
fails lets the request through and reports the error. The PostgreSQL limiter that production uses is
`@ador/database/rate-limit`.

## Caching and files

Every `GET` operation states a `cache` policy (`no-store`, `revalidate` or `max-age`) and nothing else may; `registerHttpOperation`
refuses the rest. The web adapter puts the policy on the wire with `presentResponse`: a strong `ETag` of the exact bytes, `Cache-Control`
(`private`, with `Vary: Cookie`, unless the operation is open to everyone), and a `304` with no body for a matching `If-None-Match`.
Errors, writes and operations that say `no-store` are never kept. An operation that answers with a file lists the media types in `files`
and returns an `HttpFile`; it is sent with `nosniff` and a sandboxing content security policy.

A non-`GET` operation named like a read (`get`, `list`, `read`, `find`, `search`, `check`, `load`, `fetch`, `describe` and a capital) is refused at
registration unless it states `readsAsPost`, the reason its input must stay out of an address; nothing else may state one. A read is a `GET` by default,
so adding one as a `POST` is a decision with a written reason.

## Ownership

Platform engineering.
