//! The traces the indexer records for a claim that succeeds and one that reverts are the fixtures the platform's trace decoder is
//! tested against (`abi/trace-vectors.json`). This test keeps the file honest: it fails, showing the new bytes, whenever the
//! indexer's output changes.
mod support;

use alkanes::view;
use support::Chain;
use support::Wallet;
use wasm_bindgen_test::wasm_bindgen_test;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[wasm_bindgen_test]
fn the_indexer_records_a_success_and_a_failure() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    let first = chain.claim(Wallet::A, 7);
    let second = chain.claim(Wallet::A, 7);
    chain.index();
    let success = view::trace(&first.trace)?;
    let failure = view::trace(&second.trace)?;
    assert!(!success.is_empty() && !failure.is_empty());
    let recorded: serde_json::Value =
        serde_json::from_str(include_str!("../../abi/trace-vectors.json"))?;
    assert_eq!(recorded["success"], hex(&success).as_str(), "success");
    assert_eq!(recorded["failure"], hex(&failure).as_str(), "failure");
    Ok(())
}

#[wasm_bindgen_test]
fn the_indexer_records_the_creation_of_a_game() -> anyhow::Result<()> {
    let chain = Chain::deploy_from_templates();
    let creation = chain.initialisation();
    chain.index();
    let trace = view::trace(&creation.trace)?;
    assert!(!trace.is_empty());
    let recorded: serde_json::Value =
        serde_json::from_str(include_str!("../../abi/trace-vectors.json"))?;
    assert_eq!(recorded["creation"], hex(&trace).as_str(), "creation");
    Ok(())
}
