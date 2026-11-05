# `@frostbite/client-http`

The browser-side HTTP requester shared by every feature client. It sends one body-based operation to
a platform route, parses the response with the route's shared schema, and turns failures into a typed
error, so features do not each reimplement fetch, envelope parsing, or retry classification.

## Public API

- `createRequester(fetchImpl)(route, schema, { body, idempotencyKey, signal })` — returns the parsed
  success value or throws `ApiError`. A response that fails the schema is an error, never a domain value.
- `ApiError(code, status, message)` — carries the stable error code from the shared error envelope.
- `isRetryableApiError(error)` — true only for failures a retry can fix (network and server faults).
- `sameOriginFetch` — the default fetch, bound to the page origin.

## Invariants

- Every response body is untrusted until the route's schema accepts it.
- An idempotency key is sent only when the caller supplies one; the caller owns key lifetime.
- No feature-specific behaviour lives here.

## Dependencies and configuration

Depends on `@frostbite/shared` (routes, error envelope). No environment configuration.

## Verification

Run `typecheck`, `test:unit`, `test:integration`, or `test:coverage`. Platform engineering owns this package.

## Ownership

Platform engineering.
