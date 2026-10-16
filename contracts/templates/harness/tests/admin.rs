mod support;

use alkanes::tests::helpers::assert_revert_context;
use rewards_core::opcode::game;
use support::{limit, paused, Chain, AUTH_TOKEN};
use wasm_bindgen_test::wasm_bindgen_test;

/// What the auth token's `only_owner` check reverts with.
const NEEDS_TOKEN: &str = "Auth token is not in incoming alkanes";

#[wasm_bindgen_test]
fn initialising_hands_the_auth_token_to_the_caller() {
    let chain = Chain::deploy();
    chain.index();
    assert_eq!(chain.held(chain.initialisation(), AUTH_TOKEN), 1);
}

#[wasm_bindgen_test]
fn the_game_can_only_be_initialised_once() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    let again = chain.stranger(vec![game::INITIALIZE, 1, 1]);
    chain.index();
    assert_revert_context(&again.trace, "already initialized")
}

#[wasm_bindgen_test]
fn administration_needs_the_auth_token() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    let calls = [
        vec![game::DEFINE_MILESTONE, 7, 1],
        vec![game::PAUSE],
        vec![game::RESUME],
    ]
    .map(|call| chain.stranger(call));
    chain.index();
    for call in calls {
        assert_revert_context(&call.trace, NEEDS_TOKEN)?;
    }
    assert_eq!(limit(7)?, 0);
    assert!(!paused()?);
    Ok(())
}

#[wasm_bindgen_test]
fn the_auth_token_comes_back_after_each_administrative_call() {
    let mut chain = Chain::deploy();
    chain.pause();
    chain.resume();
    let last = chain.define(7, 1, None);
    chain.index();
    assert_eq!(chain.held(last, AUTH_TOKEN), 1);
}

#[wasm_bindgen_test]
fn pausing_and_resuming_change_the_paused_view() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.pause();
    chain.index();
    assert!(paused()?);

    let mut chain = Chain::deploy();
    chain.pause();
    chain.resume();
    chain.index();
    assert!(!paused()?);
    Ok(())
}

#[wasm_bindgen_test]
fn the_game_names_its_auth_token() -> anyhow::Result<()> {
    let chain = Chain::deploy();
    chain.index();
    let mut expected = AUTH_TOKEN.0.to_le_bytes().to_vec();
    expected.extend(AUTH_TOKEN.1.to_le_bytes());
    assert_eq!(
        support::view(support::GAME, vec![game::GET_AUTH_TOKEN])?,
        expected
    );
    Ok(())
}
