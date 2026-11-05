#!/usr/bin/env bash
# The gates for the contract templates, one step at a time (the root package.json calls these).
#
# The two contracts and the harness only run on wasm32, under wasm-bindgen-test-runner, so they are
# type-checked and linted for that target. `rewards-core` holds every rule that does not need the
# Alkanes runtime, runs natively, and is the crate whose coverage is measured; the contracts are
# thin and each operation is exercised by the harness instead.
set -euo pipefail
cd "$(dirname "$0")"
wasm=(--target wasm32-unknown-unknown)

# The harness tests embed the built contracts (include_bytes!), so they do not even compile until build.sh has made them.
build() { ./build.sh >/dev/null; }

case "${1:-}" in
  lint)
    build
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets "${wasm[@]}" -- -D warnings
    cargo clippy -p rewards-core -p responder-kit --all-targets -- -D warnings
    ;;
  typecheck)
    build
    cargo check --workspace --all-targets "${wasm[@]}"
    cargo check -p rewards-core --all-targets
    ;;
  hashes)
    ./build.sh --check
    ;;
  core)
    build
    cargo test -p rewards-core
    ;;
  harness)
    # The harness runs the built contracts in WebAssembly, one test file after another, and takes most of the time. With an index and a
    # count it runs every count-th file (in name order), so the files can be shared between machines; a new file is picked up by name.
    index="${2:-0}"
    count="${3:-1}"
    build
    cd harness
    files=()
    for file in tests/*.rs; do files+=("$(basename "$file" .rs)"); done
    selected=()
    # The crate's own unit tests (none today) run with the first share, so that no test the plain run would reach is left out.
    if (( index == 0 )); then selected+=(--lib); fi
    for position in "${!files[@]}"; do
      if (( position % count == index )); then selected+=(--test "${files[$position]}"); fi
    done
    if (( ${#selected[@]} == 0 )); then echo "no test files for shard $index of $count" >&2; exit 1; fi
    cargo test --no-fail-fast "${selected[@]}"
    ;;
  test)
    "$0" core
    "$0" harness 0 1
    ;;
  coverage)
    cargo llvm-cov -p rewards-core --fail-under-lines 90 --fail-under-functions 90 --fail-under-regions 90
    cargo llvm-cov report -p rewards-core --lcov --output-path target/llvm-cov-target/lcov.info
    ;;
  *)
    echo "usage: ci.sh lint|typecheck|hashes|core|harness [index count]|test|coverage" >&2
    exit 2
    ;;
esac
