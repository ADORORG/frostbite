//! One milestone collectible: supply one, with a small payload read through `get-data`.
//! Modelled on the stock `alkanes-std-orbital` (opcodes 0, 99, 100, 101, 1000).
use alkanes_runtime::declare_alkane;
use alkanes_runtime::message::MessageDispatch;
use alkanes_runtime::{runtime::AlkaneResponder, storage::StoragePointer};
use alkanes_support::{cellpack::Cellpack, id::AlkaneId, parcel::AlkaneTransferParcel};
use alkanes_support::{parcel::AlkaneTransfer, response::CallResponse};
use anyhow::Result;

mod render;
#[allow(unused_imports)]
use metashrew_support::compat::{to_arraybuffer_layout, to_passback_ptr};
use metashrew_support::index_pointer::KeyValuePointer;

#[derive(Default)]
pub struct Collectible(());

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
}

impl Collectible {
    fn config(&self, key: &str) -> StoragePointer {
        StoragePointer::from_keyword(key)
    }

    fn initialize(&self, milestone: u128, serial: u128) -> Result<CallResponse> {
        self.observe_initialization()?;
        let context = self.context()?;
        let mut response = CallResponse::forward(&context.incoming_alkanes);
        self.config("/game")
            .set(std::sync::Arc::new(Vec::<u8>::from(context.caller)));
        self.config("/milestone").set_value::<u128>(milestone);
        self.config("/serial").set_value::<u128>(serial);
        response.alkanes.0.push(AlkaneTransfer {
            id: context.myself,
            value: 1,
        });
        Ok(response)
    }

    fn text(&self, value: &str) -> Result<CallResponse> {
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        response.data = value.as_bytes().to_vec();
        Ok(response)
    }

    fn get_name(&self) -> Result<CallResponse> {
        self.text("Milestone")
    }

    fn get_symbol(&self) -> Result<CallResponse> {
        self.text("MILE")
    }

    fn get_total_supply(&self) -> Result<CallResponse> {
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        response.data = 1u128.to_le_bytes().to_vec();
        Ok(response)
    }

    /// The builder's drawing lives once in the game's contract; each collectible stores only
    /// the game, the milestone and its own serial, and asks for the drawing when it is read.
    fn get_data(&self) -> Result<CallResponse> {
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        let game: AlkaneId = self.config("/game").get().as_ref().clone().try_into()?;
        let milestone = self.config("/milestone").get_value::<u128>();
        let serial = self.config("/serial").get_value::<u128>();
        let cellpack = Cellpack {
            target: game,
            inputs: vec![101, milestone],
        };
        let art = self.staticcall(&cellpack, &AlkaneTransferParcel::default(), self.fuel())?;
        response.data = render::picture(&art.data, milestone, serial);
        Ok(response)
    }
}

impl AlkaneResponder for Collectible {}

declare_alkane! {
    impl AlkaneResponder for Collectible {
        type Message = CollectibleMessage;
    }
}
