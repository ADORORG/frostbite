# `@repo/config`

Canonical environment metadata, application environment validation, checked-in template parity, and the typed policy records the platform
reads its business values from.

## Purpose

Environment definitions describe ownership, exposure, requirement, and secret status. Runtime schemas narrow process input at application
boundaries, while `env:check` ensures every documented environment template contains the canonical keys in the same order.
`apps/web/.env.example` mirrors the root contract because Next.js loads `apps/web/.env.local`; ignored value files are checked for the same key
inventory without inspecting or logging their values. Business policy values (sign-in codes, setup links, authorization) live here as typed,
versioned records rather than as literals in features.

## Public API

| Export            | What it is                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `./env`           | The runtime environment parsers (the platform's settings, game launch settings) narrowed from `process.env`. |
| `./beta-network`  | Which test network the beta runs on (`BETA_NETWORK`; blank means signet).                                    |
| `./mail`          | The mail transport settings (one SMTP sender).                                                               |
| `./rewards-chain` | The rewards chain settings, including the fee source.                                                        |
| `./authorization` | The role and capability policy (who may review collections, manage roles, administer games).                 |
| `./email-code`    | The email one-time-code policy (length, tries, lifetime, resend wait).                                       |
| `./setup-link`    | The first-admin setup-link policy (lifetime).                                                                |
| `./transport`     | The rule that plaintext loopback transport is never accepted in hosted environments.                         |

## Dependencies

`@frostbite/shared` for the shared schemas, `@frostbite/mail` for the mail settings types, and `zod`. Nothing in the platform reads `process.env`
outside this package and the framework entry points.

## Configuration

`pnpm env:check` (also run by every workspace's `env:check`) verifies the templates and any local value file against the canonical
inventory. Real `.env*` files are secret and ignored; only the `.example` templates are committed.

## Invariants

- Every supported key is documented in `.env.example`, in the same order in every committed template.
- Missing, invalid or contradictory configuration fails at start, never later.
- A value file is checked for key names only; its values are never printed or logged.

## Tests

`pnpm --filter @repo/config test:unit`, `test:integration`, `test:coverage`, and `env:check`.

## Ownership

Platform engineering. A new setting is added to the definitions, to every template, and to its parser together.
