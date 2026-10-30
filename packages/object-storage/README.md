# `@ador/object-storage`

Provider-neutral server-side object-storage contracts.

## Public API

`ObjectStoragePort` owns exact-key presigning, metadata lookup, streamed reads/writes, conditional
private-to-public copy, and deletion. `parseObjectKey` validates untrusted key text before it becomes
an owned `ObjectKey`. Each adapter exposes a validated stable provider ID for persisted object
provenance. Stable `ObjectStorageError` codes keep provider failures out of consumers.

## Invariants and ownership

Keys are relative, non-empty, control-character-free paths no longer than 1,024 characters. Bodies
remain Node streams and are never implicitly buffered. Provider SDK types, bucket names, credentials,
and URLs cannot cross this boundary. Platform engineering owns this package.

## Dependencies and configuration

This package depends only on Zod and has no environment configuration. Provider adapters own their
configuration. Run `typecheck`, `test:unit`, `test:integration`, or `test:coverage` locally.

## Ownership

Platform engineering.
