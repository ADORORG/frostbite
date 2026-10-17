#!/usr/bin/env bash
# Builds the two pieces of the local Alkanes indexer from the exact revisions the contract harness is pinned to
# (contracts/templates/Cargo.lock): `rockshrew-mono` (the Metashrew indexer host) and `alkanes.wasm` built for regtest.
# The results go to tooling/regtest/.regtest/bin. The first build takes a quarter of an hour or more.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lock="$here/../../contracts/templates/Cargo.lock"
out="$here/.regtest/bin"
mkdir -p "$out"

revision() {
  # The commit a git dependency is locked to: `source = "git+https://...#<commit>"`.
  grep -m1 -A3 "name = \"$1\"" "$lock" | sed -n 's/.*#\([0-9a-f]*\)".*/\1/p' | head -1
}

checkout() {
  # The checkout cargo made for a repository at a commit.
  ls -d "$HOME"/.cargo/git/checkouts/"$1"-*/"${2:0:7}" 2>/dev/null | head -1
}

metashrew="$(checkout metashrew "$(revision metashrew-core)")"
alkanes="$(checkout alkanes-rs "$(revision alkanes)")"
if [ -z "$metashrew" ] || [ -z "$alkanes" ]; then
  echo "A pinned checkout is missing. Run 'cargo fetch' in contracts/templates first." >&2
  exit 1
fi

(cd "$metashrew" && cargo build --release -p rockshrew-mono --target-dir "$here/.regtest/target-metashrew")
cp "$here/.regtest/target-metashrew/release/rockshrew-mono" "$out/"
(cd "$alkanes" && cargo build --release --target wasm32-unknown-unknown --features regtest --target-dir "$here/.regtest/target-alkanes")
cp "$here/.regtest/target-alkanes/wasm32-unknown-unknown/release/alkanes.wasm" "$out/"
# The auth-token factory the game template calls when it creates a game's auth token. Mainnet has it; a fresh regtest chain does not,
# so its code is taken from the same checkout for the lifecycle driver to deploy (packages/chain/regtest).
sed -n 's/.*hex!("\([0-9a-f]*\)").*/\1/p' "$alkanes/src/precompiled/alkanes_std_auth_token_build.rs" | xxd -r -p > "$out/auth-token.wasm"
echo "Built: $out/rockshrew-mono and $out/alkanes.wasm"
