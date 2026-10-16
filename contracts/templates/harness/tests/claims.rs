mod support;

use alkanes::tests::helpers::assert_revert_context;
use rewards_core::policy::Refusal;
use support::{claimed, picture, Chain, Wallet, FIRST_COLLECTIBLE};
use wasm_bindgen_test::wasm_bindgen_test;

/// The `n`th collectible a deployment creates.
fn collectible(n: u128) -> (u128, u128) {
    (2, FIRST_COLLECTIBLE + n)
}

#[wasm_bindgen_test]
fn a_claim_sends_a_numbered_collectible_to_the_wallet() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 2, None);
    let first = chain.claim(Wallet::A, 7);
    let second = chain.claim(Wallet::A, 7);
    chain.index();
    assert_eq!(chain.held(first, collectible(0)), 1);
    assert_eq!(chain.held(second, collectible(1)), 1);
    assert!(picture(collectible(0).1)?.contains("#001"));
    assert!(picture(collectible(1).1)?.contains("#002"));
    Ok(())
}

#[wasm_bindgen_test]
fn a_wallet_stops_at_the_limit_of_each_milestone_separately() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 2, None);
    chain.define(8, 1, None);
    chain.claim(Wallet::A, 7);
    chain.claim(Wallet::A, 7);
    let over = chain.claim(Wallet::A, 7);
    chain.claim(Wallet::A, 8);
    let over_eight = chain.claim(Wallet::A, 8);
    chain.index();
    assert_revert_context(&over.trace, Refusal::LimitReached.message())?;
    assert_revert_context(&over_eight.trace, Refusal::LimitReached.message())?;
    assert_eq!((claimed(Wallet::A, 7)?, claimed(Wallet::A, 8)?), (2, 1));
    Ok(())
}

#[wasm_bindgen_test]
fn another_wallet_has_its_own_count_and_continues_the_edition_numbers() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    chain.claim(Wallet::A, 7);
    let other = chain.claim(Wallet::B, 7);
    chain.index();
    assert_eq!(chain.held(other, collectible(1)), 1);
    assert!(picture(collectible(1).1)?.contains("#002"));
    assert_eq!((claimed(Wallet::A, 7)?, claimed(Wallet::B, 7)?), (1, 1));
    Ok(())
}

#[wasm_bindgen_test]
fn an_undefined_milestone_cannot_be_claimed() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    let claim = chain.claim(Wallet::A, 99);
    chain.index();
    assert_revert_context(&claim.trace, Refusal::UnknownMilestone.message())?;
    assert_eq!(claimed(Wallet::A, 99)?, 0);
    Ok(())
}

#[wasm_bindgen_test]
fn a_paused_game_refuses_claims_until_it_resumes() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 2, None);
    chain.pause();
    let paused = chain.claim(Wallet::A, 7);
    chain.resume();
    let open = chain.claim(Wallet::A, 7);
    chain.index();
    assert_revert_context(&paused.trace, Refusal::Paused.message())?;
    assert_eq!(chain.held(open, collectible(0)), 1);
    assert_eq!(claimed(Wallet::A, 7)?, 1);
    Ok(())
}

#[wasm_bindgen_test]
fn a_refused_claim_uses_no_edition_number() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    chain.claim(Wallet::A, 7);
    chain.claim(Wallet::A, 7);
    let next = chain.claim(Wallet::B, 7);
    chain.index();
    assert_eq!(chain.held(next, collectible(1)), 1);
    assert!(picture(collectible(1).1)?.contains("#002"));
    Ok(())
}
