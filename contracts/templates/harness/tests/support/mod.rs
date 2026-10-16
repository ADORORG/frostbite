//! A small chain for the contract tests: deploy a game, then append administration and claim
//! transactions, index them, and read views. Transaction building lives in `chain`, reading in
//! `read`; nothing here asserts anything.

#![allow(dead_code, unused_imports)]

pub mod chain;
pub mod read;

pub use chain::{Chain, Wallet};
pub use read::{art, claimed, fuel, limit, number, paused, picture, text, view};

/// Built by `cargo build --release --target wasm32-unknown-unknown` (see the README).
pub const COLLECTIBLE: &[u8] =
    include_bytes!("../../../target/wasm32-unknown-unknown/release/milestone_collectible.wasm");
pub const REWARDS: &[u8] =
    include_bytes!("../../../target/wasm32-unknown-unknown/release/game_rewards.wasm");

/// Where the collectible template is deployed (`{3, TEMPLATE}`; instances are made from `{6, TEMPLATE}`).
pub const TEMPLATE: u128 = 1000;
/// The most bytes a milestone drawing may have, as the game is initialised in these tests.
pub const MAX_ART: u128 = 4096;
/// Enough fuel for any view in these tests.
pub const VIEW_FUEL: u64 = 100_000_000;

/// The ids the deployment produces: the game is the first instance, its auth token the second.
pub const GAME: (u128, u128) = (2, 1);
pub const AUTH_TOKEN: (u128, u128) = (2, 2);
/// Collectibles are created after the auth token, in claim order.
pub const FIRST_COLLECTIBLE: u128 = 3;

/// A drawing a builder might supply: one SVG document, no scripts.
pub const DRAWING: &str =
    "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" fill=\"#f60\"/></svg>";
