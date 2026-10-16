//! `milestone-collectible@1`: the one-off item a claim creates. It stores only the game that
//! issued it, its milestone and its edition number; the picture is built when it is read, from the
//! drawing the game keeps once for the milestone.
//!
//! Anyone can create an instance of a template, so a collectible is genuine only if its issuing
//! game is one the platform lists for that game. `get-attributes` names the issuer.

mod state;
mod views;

use alkanes_runtime::declare_alkane;
use alkanes_runtime::message::MessageDispatch;
use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::{parcel::AlkaneTransfer, response::CallResponse};
use anyhow::Result;
#[allow(unused_imports)]
use metashrew_support::compat::{to_arraybuffer_layout, to_passback_ptr};
use responder_kit::Answers;

#[derive(Default)]
pub struct Collectible(());

/// The Orbital interface: 99, 100, 101 are the token views; 1000 to 1002 describe the content.
/// Numbers are listed once, in `rewards_core::opcode::collectible`, and published in
/// `abi/milestone-collectible@1.json`.
#[derive(MessageDispatch)]
enum CollectibleMessage {
    #[opcode(0)]
    Initialize { milestone: u128, serial: u128 },

    #[opcode(99)]
    #[returns(String)]
    GetName,

    #[opcode(100)]
    #[returns(String)]
    GetSymbol,

    #[opcode(101)]
    #[returns(u128)]
    GetTotalSupply,

    #[opcode(1000)]
    #[returns(Vec<u8>)]
    GetData,

    #[opcode(1001)]
    #[returns(String)]
    GetContentType,

    #[opcode(1002)]
    #[returns(String)]
    GetAttributes,
}

impl Collectible {
    fn initialize(&self, milestone: u128, serial: u128) -> Result<CallResponse> {
        self.observe_initialization()?;
        let context = self.context()?;
        self.set_origin(&context.caller, milestone, serial);
        let mut response = self.forwarded()?;
        response.alkanes.0.push(AlkaneTransfer {
            id: context.myself,
            value: 1,
        });
        Ok(response)
    }
}

impl AlkaneResponder for Collectible {}
impl Answers for Collectible {}

declare_alkane! {
    impl AlkaneResponder for Collectible {
        type Message = CollectibleMessage;
    }
}
