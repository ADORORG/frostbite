//! A claim can be tried against the indexer without sending it: the platform runs `claim` as a simulation with a transaction whose
//! output 0 pays the claimant, to tell a player before they sign whether it would be refused. A simulation changes nothing.
mod support;

use alkanes::view;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::id::AlkaneId;
use bitcoin::{absolute::LockTime, transaction::Version, Amount, Transaction, TxOut};
use rewards_core::opcode::game;
use support::{claimed, Chain, Wallet, FIRST_COLLECTIBLE, GAME, VIEW_FUEL};
use wasm_bindgen_test::wasm_bindgen_test;

fn try_claim(wallet: Wallet, milestone: u128) -> anyhow::Result<usize> {
    let call = Cellpack {
        target: AlkaneId {
            block: GAME.0,
            tx: GAME.1,
        },
        inputs: vec![game::CLAIM, milestone],
    };
    let mut parcel = view::plain_parcel_from_cellpack(call);
    parcel.transaction = Transaction {
        version: Version::TWO,
        lock_time: LockTime::ZERO,
        input: vec![],
        output: vec![TxOut {
            value: Amount::from_sat(546),
            script_pubkey: wallet.script(),
        }],
    };
    let (response, _fuel) = view::simulate_parcel(&parcel, VIEW_FUEL)?;
    Ok(response.alkanes.0.len())
}

#[wasm_bindgen_test]
fn a_simulated_claim_shows_the_outcome_and_changes_nothing() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    chain.index();
    assert_eq!(
        try_claim(Wallet::A, 7)?,
        1,
        "the collectible a claim would return"
    );
    assert_eq!(claimed(Wallet::A, 7)?, 0, "nothing was claimed");
    assert!(
        try_claim(Wallet::A, 99).is_err(),
        "an undefined milestone would be refused"
    );

    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    chain.claim(Wallet::A, 7);
    chain.index();
    assert_eq!(claimed(Wallet::A, 7)?, 1);
    let refused = try_claim(Wallet::A, 7);
    assert!(refused.is_err() && format!("{refused:?}").contains("claim limit reached"));
    assert_eq!(
        try_claim(Wallet::B, 7)?,
        1,
        "another wallet's claim would go through"
    );
    let _ = FIRST_COLLECTIBLE;
    Ok(())
}
