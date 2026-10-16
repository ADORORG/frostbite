use alkanes::indexer::index_block;
use alkanes::tests::helpers::{self as h, assert_revert_context, clear};
use alkanes::view;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::id::AlkaneId;
use bitcoin::{Block, OutPoint, Witness};
use protorune_support::balance_sheet::BalanceSheetOperations;
use protorune_support::balance_sheet::ProtoruneRuneId;
use protorune_support::protostone::ProtostoneEdict;
use sha2::Digest;
use wasm_bindgen_test::wasm_bindgen_test;

const COLLECTIBLE: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/milestone_collectible.wasm");
const REWARDS: &[u8] =
    include_bytes!("../../target/wasm32-unknown-unknown/release/game_rewards.wasm");
const TEMPLATE: u128 = 1000;
const VIEW_FUEL: u64 = 100_000_000;

fn cp(block: u128, tx: u128, inputs: Vec<u128>) -> Cellpack {
    Cellpack {
        target: AlkaneId { block, tx },
        inputs,
    }
}

#[wasm_bindgen_test]
fn claim_creates_a_collectible() -> anyhow::Result<()> {
    clear();
    let block = h::init_with_multiple_cellpacks_with_tx(
        vec![COLLECTIBLE.to_vec(), REWARDS.to_vec(), vec![]],
        vec![
            cp(3, TEMPLATE, vec![]),
            cp(1, 0, vec![0, TEMPLATE, 2, 4096]),
            cp(2, 1, vec![1, 7]),
        ],
    );
    index_block(&block, 880_000)?;
    let data = view::call_view(&AlkaneId { block: 2, tx: 2 }, &vec![1000u128], VIEW_FUEL)?;
    let picture = String::from_utf8(data)?;
    assert!(
        picture.contains("#001") && picture.contains("crispEdges"),
        "{picture}"
    );
    Ok(())
}

/// Deploys the template and the game, then claims `milestones` in order; each claim is a
/// chained transaction whose output 0 pays the same address.
fn claims(milestones: &[u128]) -> Block {
    claims_with_art(milestones, &[])
}

fn claims_with_art(milestones: &[u128], art: &[(u128, String)]) -> Block {
    clear();
    let mut binaries = vec![COLLECTIBLE.to_vec(), REWARDS.to_vec()];
    let mut packs = vec![
        cp(3, TEMPLATE, vec![]),
        cp(1, 0, vec![0, TEMPLATE, 2, 4096]),
    ];
    for (milestone, svg) in art {
        let mut inputs = vec![2, *milestone];
        inputs.extend(alkanes_support::utils::string_to_u128_list(svg.clone()));
        binaries.push(vec![]);
        packs.push(cp(2, 1, inputs));
    }
    for m in milestones {
        binaries.push(vec![]);
        packs.push(cp(2, 1, vec![1, *m]));
    }
    let block = h::init_with_multiple_cellpacks_with_tx(binaries, packs);
    index_block(&block, 880_000).expect("block indexes");
    block
}

fn data(tx: u128) -> anyhow::Result<String> {
    Ok(String::from_utf8(view::call_view(
        &AlkaneId { block: 2, tx },
        &vec![1000u128],
        VIEW_FUEL,
    )?)?)
}

#[wasm_bindgen_test]
fn every_claim_is_its_own_collectible_until_the_limit() -> anyhow::Result<()> {
    let block = claims(&[7, 7, 7]);
    assert!(data(2)?.contains("#001"));
    assert!(data(3)?.contains("#002"));
    let third = OutPoint {
        txid: block.txdata[5].compute_txid(),
        vout: 3,
    };
    assert_revert_context(&third, "claim limit reached")?;
    Ok(())
}

#[wasm_bindgen_test]
fn a_different_milestone_has_its_own_count() -> anyhow::Result<()> {
    claims(&[7, 7, 8]);
    let (seven, eight) = (data(2)?, data(4)?);
    assert!(eight.contains("#001"));
    assert_ne!(seven.replace("#001", ""), eight.replace("#001", ""));
    Ok(())
}

#[wasm_bindgen_test]
fn the_runtime_moves_a_collectible_without_calling_the_contract() -> anyhow::Result<()> {
    let block = claims(&[7]);
    let claim = &block.txdata[3];
    let held = OutPoint {
        txid: claim.compute_txid(),
        vout: 0,
    };
    let sheet = h::get_sheet_for_outpoint(&block, 3, 0)?;
    assert!(
        sheet.get(&ProtoruneRuneId { block: 2, tx: 2 }) == 1,
        "claim sheet {:?} runtime {:?}",
        sheet,
        h::get_sheet_for_runtime()
    );
    let to = bitcoin::TxOut {
        value: bitcoin::Amount::from_sat(1000),
        script_pubkey: claim.output[0].script_pubkey.clone(),
    };
    let input = bitcoin::TxIn {
        previous_output: held,
        script_sig: bitcoin::ScriptBuf::new(),
        sequence: bitcoin::Sequence::MAX,
        witness: Witness::new(),
    };
    let stone = protorune_support::protostone::Protostone {
        burn: None,
        message: vec![],
        edicts: vec![ProtostoneEdict {
            id: ProtoruneRuneId { block: 2, tx: 2 },
            amount: 1,
            output: 0,
        }],
        refund: Some(0),
        pointer: Some(0),
        from: None,
        protocol_tag: 1,
    };
    let transfer = h::create_protostone_tx_with_inputs(vec![input], vec![to], stone);
    let mut next = protorune::test_helpers::create_block_with_coinbase_tx(880_001);
    next.txdata.push(transfer);
    index_block(&next, 880_001)?;
    let moved = h::get_sheet_for_outpoint(&next, 1, 0)?;
    assert_eq!(moved.get(&ProtoruneRuneId { block: 2, tx: 2 }), 1);
    Ok(())
}

#[wasm_bindgen_test]
fn the_claimed_count_is_readable_by_holder_and_milestone() -> anyhow::Result<()> {
    let block = claims(&[7, 7, 8]);
    let script = block.txdata[3].output[0].script_pubkey.as_bytes();
    let digest = sha2::Sha256::digest(script);
    let half = |part: &[u8]| u128::from_le_bytes(part.try_into().expect("16 bytes"));
    let read = |milestone: u128| -> anyhow::Result<u128> {
        let input = vec![100, half(&digest[..16]), half(&digest[16..]), milestone];
        let bytes = view::call_view(&AlkaneId { block: 2, tx: 1 }, &input, 100_000)?;
        Ok(u128::from_le_bytes(bytes.as_slice().try_into()?))
    };
    assert_eq!((read(7)?, read(8)?, read(9)?), (2, 1, 0));
    Ok(())
}

const DRAWING: &str = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"#f60\"/></svg>";

#[wasm_bindgen_test]
fn a_milestone_with_art_shows_it_in_the_frame_and_others_get_the_sprite() -> anyhow::Result<()> {
    claims_with_art(&[7, 8], &[(7, DRAWING.to_string())]);
    let (drawn, plain) = (data(2)?, data(3)?);
    assert!(drawn.contains(DRAWING) && drawn.contains("#001") && !drawn.contains("crispEdges"));
    assert!(plain.contains("crispEdges") && !plain.contains(DRAWING));
    assert!(
        drawn.len() < DRAWING.len() + 700,
        "frame overhead {}",
        drawn.len() - DRAWING.len()
    );
    Ok(())
}

#[wasm_bindgen_test]
fn art_above_the_size_limit_is_refused() -> anyhow::Result<()> {
    let block = claims_with_art(&[], &[(7, "x".repeat(4097))]);
    let setter = OutPoint {
        txid: block.txdata[3].compute_txid(),
        vout: 3,
    };
    assert_revert_context(&setter, "art too large")?;
    Ok(())
}

#[wasm_bindgen_test]
fn reading_a_picture_costs_this_much_fuel() -> anyhow::Result<()> {
    claims_with_art(&[7, 8], &[(7, DRAWING.to_string())]);
    let cost = |tx: u128| -> anyhow::Result<u64> {
        let parcel = view::plain_parcel_from_cellpack(cp(2, tx, vec![1000]));
        Ok(view::simulate_parcel(&parcel, VIEW_FUEL)?.1)
    };
    let (drawn, sprite) = (cost(2)?, cost(3)?);
    assert!(
        drawn < 5_000_000 && sprite < 5_000_000,
        "drawn {drawn} sprite {sprite}"
    );
    assert!(
        drawn < sprite,
        "drawing is cheaper than generating the sprite"
    );
    Ok(())
}
