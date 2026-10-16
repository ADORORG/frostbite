mod support;

use rewards_core::opcode::collectible;
use support::{fuel, picture, text, view, Chain, Wallet, DRAWING, FIRST_COLLECTIBLE, GAME};
use wasm_bindgen_test::wasm_bindgen_test;

const DRAWN: (u128, u128) = (2, FIRST_COLLECTIBLE);
const PLAIN: (u128, u128) = (2, FIRST_COLLECTIBLE + 1);

/// Milestone 7 has a drawing and milestone 8 has none; one collectible of each is claimed.
fn setup() {
    let mut chain = Chain::deploy();
    chain.define(7, 1, Some(DRAWING.as_bytes()));
    chain.define(8, 1, None);
    chain.claim(Wallet::A, 7);
    chain.claim(Wallet::A, 8);
    chain.index();
}

#[wasm_bindgen_test]
fn a_milestone_with_a_drawing_shows_it_in_the_frame() -> anyhow::Result<()> {
    setup();
    let drawn = picture(DRAWN.1)?;
    assert!(drawn.contains(DRAWING) && drawn.contains("#001"));
    assert!(!drawn.contains("crispEdges"));
    Ok(())
}

#[wasm_bindgen_test]
fn a_milestone_without_a_drawing_shows_its_sprite() -> anyhow::Result<()> {
    setup();
    let plain = picture(PLAIN.1)?;
    assert!(plain.contains("crispEdges") && plain.contains("#001"));
    assert!(!plain.contains(DRAWING));
    Ok(())
}

#[wasm_bindgen_test]
fn the_content_type_and_attributes_describe_the_picture() -> anyhow::Result<()> {
    setup();
    assert_eq!(
        text(DRAWN, vec![collectible::GET_CONTENT_TYPE])?,
        "image/svg+xml"
    );
    let expected = format!(
        "{{\"game\":\"{}:{}\",\"milestone\":\"7\",\"serial\":1}}",
        GAME.0, GAME.1
    );
    assert_eq!(text(DRAWN, vec![collectible::GET_ATTRIBUTES])?, expected);
    Ok(())
}

#[wasm_bindgen_test]
fn the_token_views_answer_as_a_single_item() -> anyhow::Result<()> {
    setup();
    assert_eq!(text(DRAWN, vec![collectible::GET_NAME])?, "Milestone");
    assert_eq!(text(DRAWN, vec![collectible::GET_SYMBOL])?, "MILE");
    assert_eq!(
        view(DRAWN, vec![collectible::GET_TOTAL_SUPPLY])?,
        1u128.to_le_bytes()
    );
    Ok(())
}

#[wasm_bindgen_test]
fn reading_a_picture_stays_cheap() -> anyhow::Result<()> {
    setup();
    let (drawn, sprite) = (
        fuel(DRAWN, vec![collectible::GET_DATA])?,
        fuel(PLAIN, vec![collectible::GET_DATA])?,
    );
    // Measured at about 196,000 (drawn) and 446,000 (sprite). The bound guards against a return
    // to per-pixel formatting, which cost about 688,000 for the sprite alone.
    assert!(
        drawn < 300_000 && sprite < 600_000,
        "drawn {drawn} sprite {sprite}"
    );
    Ok(())
}
