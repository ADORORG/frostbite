//! Storage, and the only place its keys are named.

use alkanes_runtime::storage::StoragePointer;
use metashrew_support::index_pointer::KeyValuePointer;
use rewards_core::holder::Holder;
use std::sync::Arc;

use crate::GameRewards;

const TEMPLATE: &str = "/template";
const MAX_ART: &str = "/max-art";
const PAUSED: &str = "/paused";
const LIMIT: &str = "/limit";
const ART: &str = "/art";
const SERIAL: &str = "/serial";
const CLAIMED: &str = "/claimed";

fn keyed(table: &str, milestone: u128) -> StoragePointer {
    StoragePointer::from_keyword(table).select(&milestone.to_le_bytes().to_vec())
}

impl GameRewards {
    pub(crate) fn template(&self) -> u128 {
        StoragePointer::from_keyword(TEMPLATE).get_value::<u128>()
    }

    pub(crate) fn set_template(&self, template: u128) {
        StoragePointer::from_keyword(TEMPLATE).set_value::<u128>(template);
    }

    pub(crate) fn max_art_bytes(&self) -> u128 {
        StoragePointer::from_keyword(MAX_ART).get_value::<u128>()
    }

    pub(crate) fn set_max_art_bytes(&self, bytes: u128) {
        StoragePointer::from_keyword(MAX_ART).set_value::<u128>(bytes);
    }

    pub(crate) fn paused(&self) -> bool {
        StoragePointer::from_keyword(PAUSED).get_value::<u8>() != 0
    }

    pub(crate) fn set_paused(&self, paused: bool) {
        StoragePointer::from_keyword(PAUSED).set_value::<u8>(u8::from(paused));
    }

    /// Zero means the milestone is not defined.
    pub(crate) fn limit(&self, milestone: u128) -> u128 {
        keyed(LIMIT, milestone).get_value::<u128>()
    }

    pub(crate) fn set_limit(&self, milestone: u128, limit: u128) {
        keyed(LIMIT, milestone).set_value::<u128>(limit);
    }

    pub(crate) fn art(&self, milestone: u128) -> Vec<u8> {
        keyed(ART, milestone).get().as_ref().clone()
    }

    pub(crate) fn set_art(&self, milestone: u128, art: Vec<u8>) {
        keyed(ART, milestone).set(Arc::new(art));
    }

    pub(crate) fn claimed(&self, holder: &Holder, milestone: u128) -> u128 {
        claimed_pointer(holder, milestone).get_value::<u128>()
    }

    pub(crate) fn set_claimed(&self, holder: &Holder, milestone: u128, count: u128) {
        claimed_pointer(holder, milestone).set_value::<u128>(count);
    }

    /// The next edition number of a milestone: one more than every claim before it, by anyone.
    pub(crate) fn take_serial(&self, milestone: u128) -> u128 {
        let mut pointer = keyed(SERIAL, milestone);
        let serial = pointer.get_value::<u128>() + 1;
        pointer.set_value::<u128>(serial);
        serial
    }
}

fn claimed_pointer(holder: &Holder, milestone: u128) -> StoragePointer {
    StoragePointer::from_keyword(CLAIMED)
        .select(&holder.as_bytes().to_vec())
        .select(&milestone.to_le_bytes().to_vec())
}
