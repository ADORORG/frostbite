//! `game-rewards@1`: one contract per game. A player's wallet claims a milestone and receives a
//! collectible of its own, up to a per-wallet limit for that milestone. The platform holds the
//! auth token that defines milestones and pauses claims (ADR-018 Amendment 3).
//!
//! Operations are split by what they touch: `admin` (auth token), `milestones` (definitions),
//! `claim`, and read-only `views`. `state` is the only place storage keys are written down.

mod admin;
mod claim;
mod claimant;
mod milestones;
mod state;
mod views;

use alkanes_runtime::auth::AuthenticatedResponder;
use alkanes_runtime::declare_alkane;
use alkanes_runtime::message::MessageDispatch;
use alkanes_runtime::runtime::AlkaneResponder;
#[allow(unused_imports)]
use metashrew_support::compat::{to_arraybuffer_layout, to_passback_ptr};
use responder_kit::Answers;

#[derive(Default)]
pub struct GameRewards(());

/// The ABI of `game-rewards@1`. Opcode numbers are part of the interface: never reuse one.
#[derive(MessageDispatch)]
enum GameRewardsMessage {
    /// Once. Returns the auth token to the caller. `max_art_bytes` bounds a milestone's drawing.
    #[opcode(0)]
    Initialize {
        collectible_template: u128,
        max_art_bytes: u128,
    },

    #[opcode(1)]
    Claim { milestone: u128 },

    /// Auth token. Defines a milestone for good; the drawing, if any, travels in the witness.
    #[opcode(2)]
    DefineMilestone { milestone: u128, limit: u128 },

    /// Auth token.
    #[opcode(3)]
    Pause,

    /// Auth token.
    #[opcode(4)]
    Resume,

    #[opcode(99)]
    #[returns(String)]
    GetName,

    /// How many times a holder claimed a milestone; the holder is `rewards_core::holder::Holder`.
    #[opcode(100)]
    #[returns(u128)]
    GetClaimed {
        holder_first_half: u128,
        holder_second_half: u128,
        milestone: u128,
    },

    #[opcode(101)]
    #[returns(u128)]
    GetLimit { milestone: u128 },

    /// The collectible calls this one by `rewards_core::opcode::game::GET_MILESTONE_ART`.
    #[opcode(102)]
    #[returns(Vec<u8>)]
    GetMilestoneArt { milestone: u128 },

    #[opcode(103)]
    #[returns(u128)]
    GetPaused,
}

impl AlkaneResponder for GameRewards {}
impl AuthenticatedResponder for GameRewards {}
impl Answers for GameRewards {}

declare_alkane! {
    impl AlkaneResponder for GameRewards {
        type Message = GameRewardsMessage;
    }
}
