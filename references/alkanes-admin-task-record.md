# Game administration on bitcoin-alkanes (G7e-5)

Branch `feat/g7e-5-alkanes-admin`, stacked on `feat/g7e-3-alkanes-build-observe`. Task #78, part of #73.
Decisions (ADR-018 Amendment 3): no standing platform key; staff sign every step by hand after reading its summary; signet first, mainnet
behind a release gate; any admin may pause (logged); witness data uses a one-time commit/reveal key.

## What it is

The staff's steps, behind the same neutral ports as claims. Neutral part (`@frostbite/shared/chain`): operations `publish-template`,
`define-milestone`, `set-claims-paused` (and `deploy`, which makes a game); summary fields `claimLimit`, `contract`, `drawing {bytes,
sha256}`, `paused`, `template {id, version, codeHash}`. Simulated chain (`@frostbite/test-kit`) builds and verifies all four.

`bitcoin-alkanes` (`packages/chain/src/bitcoin-alkanes/admin/`), one purpose per module:
`calls` (the contract calls), `action` (intent or summary to call: one source of truth for builder and verifier), `templates` (configured
template registry: on-chain id, code hash, read-only opcode, loader), `data` (drawing bytes, packed code, hash checks), `funding` (staff
wallet outputs; the auth-token output is named by `extension.adminOutput`, must be confirmed, owned, hold the token per the indexer and
match the game's `get_auth_token`), `plain-step` / `envelope-step` (one transaction, or commit and reveal), `one-time-key`, `envelope`,
`bundle` (`bitcoin-psbt-bundle` payload), `witness`, `build`, `verify`. The builder and broadcaster dispatch; the broadcaster sends a
commit before its reveal and treats "already known" as sent, so a repeat is safe; the reveal's id is the transaction followed.

Contracts: `GetAuthToken` (opcode 104) added to `game-rewards@1` (new hash in `release.json`), because the adapter must verify that the
output staff name holds the game's token.

## Verification

- Real indexer (`contracts/templates/harness`): games created from published templates, a milestone defined with its drawing through a
  TypeScript-built reveal, pause and resume; vectors in `abi/admin-transaction-vectors.json` (drift test).
- Chain package: unit tests for each module (`test/bitcoin-alkanes/admin-*.unit.test.ts`); coverage 99.0% lines, 94.0% branches.
- Mutation proof (`$CLAUDE_JOB_DIR/tmp/mutate-admin.py`): 10 mutants of fee check, witness check, commit link, code hash, token check,
  confirmation check, pause/resume, send order, drawing size, commit/reveal link: two survived at first (zero-amount token, pause/resume
  swap), tests added, all killed.
- Gates run: prettier (all), eslint (chain), `tsc` (shared, chain, test-kit, game-claims, uploads, collections, web),
  `pnpm repository:check`, chain unit and coverage.

## Not built, and said so

- **Wallet side**: no wallet signs a `bitcoin-psbt-bundle` yet (signing is qualification-only), and there is no staff page. A staff
  signing client must sign the commit and the reveal's second input. Nothing in the product claims otherwise.
- **Simulation** of admin steps (`ContractGateway.simulate`) refuses them: a define of a milestone already defined is refused by the
  chain, not predicted.
- **Template publication on the real indexer** is checked structurally only (the harness does not run a real wasm publish).
- **One-time key loss** between commit and reveal cannot occur in this design (both are built together); a commit that is sent but whose
  reveal is rejected leaves the reveal-fee amount locked under a destroyed key (a few thousand sats), which the summary's fee includes.
- The summary does not show the destination of token and change outputs; the staff wallet displays the transaction itself.
