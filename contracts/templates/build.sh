#!/usr/bin/env bash
# Reproducible release build of both templates, and their code hashes.
#
#   build.sh           builds and prints each hash
#   build.sh --check   also fails unless the hashes equal release.json (a deployed template's code
#                      hash must not change without a new template version)
#   build.sh --write   builds and rewrites release.json (only when releasing a new version)
#
# Also stages each as `<crate>.wasm` in target/templates, the folder REWARDS_TEMPLATES_DIR points at.
#
# Inputs that fix the output: the pinned toolchain (rust-toolchain.toml), Cargo.lock (--locked),
# the release profile in Cargo.toml, and the path remapping below, which keeps this checkout's
# location and the cargo cache's location out of the binary.
set -euo pipefail
cd "$(dirname "$0")"
root="$(pwd)"
mode="${1:-}"
manifest="release.json"
crates=(game-rewards milestone-collectible)

export SOURCE_DATE_EPOCH=0
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
export RUSTFLAGS="--remap-path-prefix=${root}=/template --remap-path-prefix=${cargo_home}=/cargo"
target_dir="${CARGO_TARGET_DIR:-${root}/target}"

args=()
for crate in "${crates[@]}"; do args+=(-p "$crate"); done
cargo build --release --locked --target wasm32-unknown-unknown "${args[@]}" >&2

json="{"
separator=""
for crate in "${crates[@]}"; do
  file="${target_dir}/wasm32-unknown-unknown/release/${crate//-/_}.wasm"
  hash="$(sha256sum "$file" | cut -d' ' -f1)"
  bytes="$(stat -c %s "$file")"
  printf '%s  %s bytes  %s\n' "$hash" "$bytes" "$crate"
  # The platform reads `<crate>.wasm` (hyphenated) from REWARDS_TEMPLATES_DIR; cargo writes underscores.
  mkdir -p "${target_dir}/templates"
  cp "$file" "${target_dir}/templates/${crate}.wasm"
  json="${json}${separator}\n  \"${crate}\": { \"sha256\": \"${hash}\", \"bytes\": ${bytes} }"
  separator=","
done
json="${json}\n}\n"

case "$mode" in
  --write) printf "$json" > "$manifest" ;;
  --check)
    if [ "$(printf "$json")" != "$(cat "$manifest")" ]; then
      echo "Code hashes differ from ${manifest}. Releasing a changed template needs a new version." >&2
      exit 1
    fi
    ;;
  "") ;;
  *) echo "usage: build.sh [--check|--write]" >&2; exit 2 ;;
esac
