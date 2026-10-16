mod support;

use alkanes::tests::helpers::assert_revert_context;
use rewards_core::policy::Refusal;
use support::{art, limit, Chain, Wallet, DRAWING, MAX_ART};
use wasm_bindgen_test::wasm_bindgen_test;

#[wasm_bindgen_test]
fn a_defined_milestone_shows_its_limit() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 3, None);
    chain.index();
    assert_eq!((limit(7)?, limit(8)?), (3, 0));
    Ok(())
}

#[wasm_bindgen_test]
fn a_milestone_is_never_redefined() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 3, None);
    let again = chain.define(7, 9, None);
    chain.index();
    assert_revert_context(&again.trace, Refusal::AlreadyDefined.message())?;
    assert_eq!(limit(7)?, 3);
    Ok(())
}

#[wasm_bindgen_test]
fn a_limit_of_zero_is_refused() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    let zero = chain.define(7, 0, None);
    chain.index();
    assert_revert_context(&zero.trace, Refusal::InvalidLimit.message())
}

#[wasm_bindgen_test]
fn a_drawing_is_stored_once_and_read_back_whole() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, Some(DRAWING.as_bytes()));
    chain.define(8, 1, None);
    chain.index();
    assert_eq!(art(7)?, DRAWING.as_bytes());
    assert!(art(8)?.is_empty());
    Ok(())
}

#[wasm_bindgen_test]
fn a_drawing_larger_than_one_script_push_arrives_whole() -> anyhow::Result<()> {
    let circles: String = (0..80)
        .map(|n| format!("<circle cx=\"{}\" cy=\"{}\" r=\"3\"/>", n % 100, n % 90))
        .collect();
    let big = format!("<svg viewBox=\"0 0 100 100\">{circles}</svg>");
    assert!(big.len() > 1000 && big.len() <= MAX_ART as usize);
    let mut chain = Chain::deploy();
    chain.define(7, 1, Some(big.as_bytes()));
    chain.index();
    assert_eq!(art(7)?, big.as_bytes());
    Ok(())
}

#[wasm_bindgen_test]
fn a_refused_drawing_leaves_the_milestone_undefined() -> anyhow::Result<()> {
    let too_big = format!("<svg>{}</svg>", "x".repeat(MAX_ART as usize));
    let cases = [
        (too_big.as_str(), Refusal::ArtTooLarge),
        ("not a drawing", Refusal::ArtNotSvg),
        ("<svg><script>x</script></svg>", Refusal::ArtForbidden),
    ];
    for (index, (drawing, refusal)) in cases.into_iter().enumerate() {
        let mut chain = Chain::deploy();
        let milestone = 10 + index as u128;
        let sent = chain.define(milestone, 1, Some(drawing.as_bytes()));
        let claim = chain.claim(Wallet::A, milestone);
        chain.index();
        assert_revert_context(&sent.trace, refusal.message())?;
        assert_revert_context(&claim.trace, Refusal::UnknownMilestone.message())?;
    }
    Ok(())
}
