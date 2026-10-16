//! The transactions the platform's TypeScript code builds to administer a game are accepted by the real indexer and do what they
//! say: a game is created from the published templates, a milestone is defined with its drawing carried in the witness of a real
//! commit-and-reveal reveal, and the game is paused and resumed. `abi/admin-transaction-vectors.json` holds them; the platform's
//! tests check that its code still builds exactly these bytes.
mod support;

use alkanes::tests::helpers::assert_revert_context;
use bitcoin::consensus::encode::deserialize;
use bitcoin::Transaction;
use rewards_core::policy::Refusal;
use support::{art, claimed, limit, Chain, Wallet, AUTH_TOKEN, FIRST_COLLECTIBLE};
use wasm_bindgen_test::wasm_bindgen_test;

fn transaction(vector: &serde_json::Value, field: &str) -> Transaction {
    let hex = vector[field].as_str().expect("a hex string");
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&hex[at..at + 2], 16).expect("hex"))
        .collect();
    deserialize(&bytes).expect("a transaction")
}

#[wasm_bindgen_test]
fn the_platform_creates_defines_pauses_and_resumes_a_game() -> anyhow::Result<()> {
    let vector: serde_json::Value =
        serde_json::from_str(include_str!("../../abi/admin-transaction-vectors.json"))?;
    let key: u128 = vector["key"].as_str().expect("key").parse()?;
    let drawing = vector["drawing"].as_str().expect("drawing");
    let define_input = vector["defineAdminInput"].as_u64().expect("index") as usize;
    let plain_input = vector["plainAdminInput"].as_u64().expect("index") as usize;

    let mut chain = Chain::deploy_templates();
    let created = chain.push_transaction(transaction(&vector, "createHex"));
    chain.adopt_token(created);
    chain.push_admin_transaction(transaction(&vector, "defineRevealHex"), define_input);
    let first = chain.claim(Wallet::A, key);
    chain.push_admin_transaction(transaction(&vector, "pauseHex"), plain_input);
    let refused = chain.claim(Wallet::B, key);
    let resumed = chain.push_admin_transaction(transaction(&vector, "resumeHex"), plain_input);
    let second = chain.claim(Wallet::B, key);
    chain.index();

    assert_eq!(limit(key)?, 2, "the milestone was defined with its limit");
    assert_eq!(
        art(key)?,
        drawing.as_bytes(),
        "the drawing arrived whole through the witness"
    );
    assert_eq!(chain.held(first, (2, FIRST_COLLECTIBLE)), 1);
    assert_revert_context(&refused.trace, Refusal::Paused.message())?;
    assert_eq!(chain.held(second, (2, FIRST_COLLECTIBLE + 1)), 1);
    assert_eq!(claimed(Wallet::A, key)?, 1);
    assert_eq!(claimed(Wallet::B, key)?, 1);
    // Each step spends the token the step before returned, so only the last output still holds it.
    assert_eq!(
        chain.held(resumed, AUTH_TOKEN),
        1,
        "the auth token came back after the last step"
    );
    Ok(())
}
