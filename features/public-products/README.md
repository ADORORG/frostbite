# `@ador/feature-public-products`

Detachable public discovery surfaces for launches and creators. Games are `@ador/feature-games`. The collections catalog is
`@ador/feature-public-collections`.

## Public API

`launchesFeature` and `creatorsFeature` are independent
registration exports. One explicit registry line installs or removes each domain route family; the
application contains no product-specific routing branches. Shared factories keep their contracts
and honest pre-data states aligned without coupling their registration lifecycle.

## Invariants

- Index pages report an empty catalog until an authoritative feature supplies published records.
- Detail paths validate their slug and never imply an unknown record exists.
- The feature performs no persistence, wallet, mint, publication, or on-chain operation.
- All navigation and state presentation uses shared arcade UI.
- Each public catalog contributes its own navigation item through its validated manifest.

## Dependencies and configuration

The feature depends only on plugin contracts, React, and the shared UI package. It consumes no
environment values or provider SDKs.

## Verification

Run the local `typecheck`, `test:unit`, `test:integration`, and `test:coverage` scripts. Browser
route, accessibility, responsive, reduced-motion, and visual behavior is covered by Playwright.

## Ownership

Platform front end.
