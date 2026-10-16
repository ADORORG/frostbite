//! The claim transaction the platform's TypeScript builder produces is accepted by the real indexer and does what it says: the
//! game counts the claim for the claimant and the collectible lands on output 0. `abi/claim-transaction-vector.json` is that
//! transaction, written by the builder and checked against it by the platform's tests, so the two languages cannot drift apart.
mod support;

use bitcoin::consensus::encode::deserialize;
use bitcoin::Transaction;
use rewards_core::holder::Holder;
use support::{claimed_by, Chain, FIRST_COLLECTIBLE};
use wasm_bindgen_test::wasm_bindgen_test;

fn bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&hex[at..at + 2], 16).expect("hex"))
        .collect()
}

#[wasm_bindgen_test]
fn the_transaction_the_platform_builds_claims_a_milestone() -> anyhow::Result<()> {
    let vector: serde_json::Value =
        serde_json::from_str(include_str!("../../abi/claim-transaction-vector.json"))?;
    let key: u128 = vector["key"].as_str().expect("key").parse()?;
    let transaction: Transaction = deserialize(&bytes(vector["txHex"].as_str().expect("tx")))?;
    let claimant = Holder::from_script(&bytes(vector["claimantScript"].as_str().expect("script")));
    assert_eq!(
        transaction.output[0].script_pubkey.as_bytes(),
        bytes(vector["claimantScript"].as_str().expect("script"))
    );

    let mut chain = Chain::deploy();
    chain.define(key, 1, None);
    let sent = chain.push_transaction(transaction);
    chain.index();

    assert_eq!(claimed_by(claimant, key)?, 1, "the game counted the claim");
    assert_eq!(
        chain.held(sent, (2, FIRST_COLLECTIBLE)),
        1,
        "the collectible is on output 0"
    );
    Ok(())
}
