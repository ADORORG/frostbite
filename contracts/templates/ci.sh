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
  test)
    build
    cargo test -p rewards-core
    (cd harness && cargo test --no-fail-fast)
    ;;
  coverage)
    cargo llvm-cov -p rewards-core --fail-under-lines 90 --fail-under-functions 90 --fail-under-regions 90
    cargo llvm-cov report -p rewards-core --lcov --output-path target/llvm-cov-target/lcov.info
    ;;
  *)
    echo "usage: ci.sh lint|typecheck|hashes|test|coverage" >&2
    exit 2
    ;;
esac
