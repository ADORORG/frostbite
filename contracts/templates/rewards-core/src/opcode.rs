//! The opcode numbers of both contracts, written once. The `#[opcode(n)]` attributes in the
//! contracts must be literals, so the contracts repeat these numbers; the harness drives every
//! operation through these constants, and `tests/abi.rs` checks them against the published ABI
//! files, so a literal that drifts from its constant fails a test.

/// `game-rewards@1`
pub mod game {
    pub const INITIALIZE: u128 = 0;
    pub const CLAIM: u128 = 1;
    pub const DEFINE_MILESTONE: u128 = 2;
    pub const PAUSE: u128 = 3;
    pub const RESUME: u128 = 4;
    pub const GET_NAME: u128 = 99;
    pub const GET_CLAIMED: u128 = 100;
    pub const GET_LIMIT: u128 = 101;
    pub const GET_MILESTONE_ART: u128 = 102;
    pub const GET_PAUSED: u128 = 103;
}

/// `milestone-collectible@1`. 99 to 101 are the token views and 1000 to 1002 describe the
/// content, the Orbital convention the `alkanes-rs` TypeScript SDK lists.
pub mod collectible {
    pub const INITIALIZE: u128 = 0;
    pub const GET_NAME: u128 = 99;
    pub const GET_SYMBOL: u128 = 100;
    pub const GET_TOTAL_SUPPLY: u128 = 101;
    pub const GET_DATA: u128 = 1000;
    pub const GET_CONTENT_TYPE: u128 = 1001;
    pub const GET_ATTRIBUTES: u128 = 1002;
}
