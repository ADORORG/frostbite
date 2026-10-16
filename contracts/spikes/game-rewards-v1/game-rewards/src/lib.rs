//! Spike of the per-game rewards contract (ADR-018 Amendment 3): every claim creates one
//! collectible instance from a template, and the claimant's per-milestone count is bounded.
use alkanes_runtime::declare_alkane;
use alkanes_runtime::message::MessageDispatch;
use alkanes_runtime::{runtime::AlkaneResponder, storage::StoragePointer};
use alkanes_support::{
    cellpack::Cellpack, id::AlkaneId, parcel::AlkaneTransferParcel, response::CallResponse,
};
use anyhow::{anyhow, Result};
#[allow(unused_imports)]
use metashrew_support::compat::{to_arraybuffer_layout, to_passback_ptr};
use metashrew_support::index_pointer::KeyValuePointer;
use sha2::{Digest, Sha256};

/// Alkanes calls with target block 6 create a new instance of the template at `{4, tx}`.
const CREATE_FROM_TEMPLATE_BLOCK: u128 = 6;

#[derive(Default)]
pub struct GameRewards(());

#[derive(MessageDispatch)]
enum GameRewardsMessage {
    #[opcode(0)]
    Initialize { template: u128, limit: u128 },

    #[opcode(1)]
    Claim { milestone: u128 },

    #[opcode(99)]
    #[returns(String)]
    GetName,

    /// How many times the holder claimed the milestone. The holder is the SHA-256 of its
    /// output script, split into two u128 halves (the shape `merkle-distributor` uses for its root).
    #[opcode(100)]
    #[returns(u128)]
    GetClaimed {
        holder_first_half: u128,
        holder_second_half: u128,
        milestone: u128,
    },
}

impl GameRewards {
    fn config(&self, key: &str) -> StoragePointer {
        StoragePointer::from_keyword(key)
    }

    /// The claimant is the script output 0 pays to. The runtime does not expose the previous
    /// outputs a transaction spends (`AlkaneResponder::output` is commented out upstream), so
    /// the contract cannot tell who signed an input. This is the `merkle-distributor` rule: it
    /// binds the collectible to a wallet but does not prove that wallet asked for it.
    fn claimant(&self) -> Result<Vec<u8>> {
        let tx = self.transaction_object()?;
        let output = tx
            .output
            .first()
            .ok_or_else(|| anyhow!("transaction has no outputs"))?;
        Ok(Sha256::digest(output.script_pubkey.as_bytes()).to_vec())
    }

    fn claim_pointer(&self, claimant: &[u8], milestone: u128) -> StoragePointer {
        self.config("/claimed")
            .select(&claimant.to_vec())
            .select(&milestone.to_le_bytes().to_vec())
    }

    fn initialize(&self, template: u128, limit: u128) -> Result<CallResponse> {
        self.observe_initialization()?;
        self.config("/template").set_value::<u128>(template);
        self.config("/limit").set_value::<u128>(limit);
        Ok(CallResponse::forward(&self.context()?.incoming_alkanes))
    }

    fn claim(&self, milestone: u128) -> Result<CallResponse> {
        let claimant = self.claimant()?;
        let mut pointer = self.claim_pointer(&claimant, milestone);
        let count = pointer.get_value::<u128>();
        if count >= self.config("/limit").get_value::<u128>() {
            return Err(anyhow!("claim limit reached"));
        }
        pointer.set_value::<u128>(count + 1);
        let cellpack = Cellpack {
            target: AlkaneId {
                block: CREATE_FROM_TEMPLATE_BLOCK,
                tx: self.config("/template").get_value::<u128>(),
            },
            inputs: vec![0, milestone, count + 1],
        };
        let created = self.call(&cellpack, &AlkaneTransferParcel::default(), self.fuel())?;
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        response.alkanes = created.alkanes;
        Ok(response)
    }

    fn get_claimed(&self, first: u128, second: u128, milestone: u128) -> Result<CallResponse> {
        let mut holder = first.to_le_bytes().to_vec();
        holder.extend(second.to_le_bytes());
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        let count = self.claim_pointer(&holder, milestone).get_value::<u128>();
        response.data = count.to_le_bytes().to_vec();
        Ok(response)
    }

    fn get_name(&self) -> Result<CallResponse> {
        let mut response = CallResponse::forward(&self.context()?.incoming_alkanes);
        response.data = b"GameRewards".to_vec();
        Ok(response)
    }
}

impl AlkaneResponder for GameRewards {}

declare_alkane! {
    impl AlkaneResponder for GameRewards {
        type Message = GameRewardsMessage;
    }
}
