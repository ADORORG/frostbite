# `@frostbite/client-react`

The two React hooks every browser feature needs, extracted so none reimplements them: loading a value
and acting on the server.

## Public API

- `useResource(load, key, describe)` loads on mount and whenever `key` changes, and again on `reload`.
  A newer load supersedes an older one (the older is aborted), an unmounted page never receives a late
  response, a failed reload keeps the last good value, and `replace` puts in a value the page already
  holds (such as a save's response).
- `useAction(describe)` runs one mutation at a time with a `busy` flag and the last failure as `notice`.

Both take a `describe` function that turns whatever was thrown into the feature's own failure words, so
the copy stays with the feature and the behaviour is shared.

## Dependencies and configuration

React only. No environment configuration.

## Verification

Run `typecheck`, `test:unit`, `test:integration`, or `test:coverage`. Platform engineering owns this
package.

## Ownership

Platform front end.
