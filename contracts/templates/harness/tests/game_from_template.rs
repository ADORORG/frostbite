//! A game made the way the platform makes it: its code is published once as a template and the game is an instance created from
//! it. Such a game works exactly like one deployed with its own code.
mod support;

use alkanes::tests::helpers::assert_revert_context;
use rewards_core::policy::Refusal;
use support::{claimed, limit, Chain, Wallet, AUTH_TOKEN, FIRST_COLLECTIBLE};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn an_instance_made_from_a_template_is_administered_and_claimed_like_any_game() -> anyhow::Result<()>
{
    let mut chain = Chain::deploy_from_templates();
    let defined = chain.define(7, 1, None);
    let first = chain.claim(Wallet::A, 7);
    let second = chain.claim(Wallet::A, 7);
    chain.index();
    assert_eq!(
        chain.held(defined, AUTH_TOKEN),
        1,
        "the auth token the deployment returned was spent by the definition and came back"
    );
    assert_eq!(limit(7)?, 1);
    assert_eq!(claimed(Wallet::A, 7)?, 1);
    assert_eq!(chain.held(first, (2, FIRST_COLLECTIBLE)), 1);
    assert_revert_context(&second.trace, Refusal::LimitReached.message())
}
