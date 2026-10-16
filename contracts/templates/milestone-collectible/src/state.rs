//! Storage, and the only place its keys are named.

use alkanes_runtime::storage::StoragePointer;
use alkanes_support::id::AlkaneId;
use anyhow::Result;
use metashrew_support::index_pointer::KeyValuePointer;
use std::sync::Arc;

use crate::Collectible;

const GAME: &str = "/game";
const MILESTONE: &str = "/milestone";
const SERIAL: &str = "/serial";

/// Where the collectible came from, as recorded when it was created.
pub(crate) struct Origin {
    pub(crate) game: AlkaneId,
    pub(crate) milestone: u128,
    pub(crate) serial: u128,
}

impl Collectible {
    pub(crate) fn set_origin(&self, game: &AlkaneId, milestone: u128, serial: u128) {
        StoragePointer::from_keyword(GAME).set(Arc::new(Vec::<u8>::from(*game)));
        StoragePointer::from_keyword(MILESTONE).set_value::<u128>(milestone);
        StoragePointer::from_keyword(SERIAL).set_value::<u128>(serial);
    }

    pub(crate) fn origin(&self) -> Result<Origin> {
        Ok(Origin {
            game: StoragePointer::from_keyword(GAME)
                .get()
                .as_ref()
                .clone()
                .try_into()?,
            milestone: StoragePointer::from_keyword(MILESTONE).get_value::<u128>(),
            serial: StoragePointer::from_keyword(SERIAL).get_value::<u128>(),
        })
    }
}
