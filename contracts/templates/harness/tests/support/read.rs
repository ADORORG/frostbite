use alkanes::view;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::id::AlkaneId;
use rewards_core::opcode::{collectible, game};

use super::chain::Wallet;

use super::VIEW_FUEL;

pub fn id(pair: (u128, u128)) -> AlkaneId {
    AlkaneId {
        block: pair.0,
        tx: pair.1,
    }
}

/// The bytes a view answers (no state change, like `eth_call`).
pub fn view(target: (u128, u128), inputs: Vec<u128>) -> anyhow::Result<Vec<u8>> {
    view::call_view(&id(target), &inputs, VIEW_FUEL)
}

pub fn text(target: (u128, u128), inputs: Vec<u128>) -> anyhow::Result<String> {
    Ok(String::from_utf8(view(target, inputs)?)?)
}

pub fn number(target: (u128, u128), inputs: Vec<u128>) -> anyhow::Result<u128> {
    Ok(u128::from_le_bytes(
        view(target, inputs)?.as_slice().try_into()?,
    ))
}

/// The picture of a collectible, as a page would read it.
pub fn picture(instance: u128) -> anyhow::Result<String> {
    text((2, instance), vec![collectible::GET_DATA])
}

/// The fuel a view uses.
pub fn fuel(target: (u128, u128), inputs: Vec<u128>) -> anyhow::Result<u64> {
    let parcel = view::plain_parcel_from_cellpack(Cellpack {
        target: id(target),
        inputs,
    });
    Ok(view::simulate_parcel(&parcel, VIEW_FUEL)?.1)
}

/// How many claims of `milestone` the game counts for `wallet`.
pub fn claimed(wallet: Wallet, milestone: u128) -> anyhow::Result<u128> {
    let (first, second) = wallet.holder().halves();
    number(
        super::GAME,
        vec![game::GET_CLAIMED, first, second, milestone],
    )
}

pub fn limit(milestone: u128) -> anyhow::Result<u128> {
    number(super::GAME, vec![game::GET_LIMIT, milestone])
}

pub fn paused() -> anyhow::Result<bool> {
    Ok(number(super::GAME, vec![game::GET_PAUSED])? != 0)
}

/// The drawing stored for a milestone (empty when it has none).
pub fn art(milestone: u128) -> anyhow::Result<Vec<u8>> {
    view(super::GAME, vec![game::GET_MILESTONE_ART, milestone])
}
