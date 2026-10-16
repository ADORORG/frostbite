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
            cp(1, 0, vec![0, TEMPLATE, 2]),
            cp(2, 1, vec![1, 7]),
        ],
    );
    index_block(&block, 880_000)?;
    let data = view::call_view(&AlkaneId { block: 2, tx: 2 }, &vec![1000u128], 100_000)?;
    assert_eq!(String::from_utf8(data)?, "{\"milestone\":7,\"serial\":1}");
    Ok(())
}

/// Deploys the template and the game, then claims `milestones` in order; each claim is a
/// chained transaction whose output 0 pays the same address.
fn claims(milestones: &[u128]) -> Block {
    clear();
    let mut binaries = vec![COLLECTIBLE.to_vec(), REWARDS.to_vec()];
    let mut packs = vec![cp(3, TEMPLATE, vec![]), cp(1, 0, vec![0, TEMPLATE, 2])];
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
        100_000,
    )?)?)
}

#[wasm_bindgen_test]
fn every_claim_is_its_own_collectible_until_the_limit() -> anyhow::Result<()> {
    let block = claims(&[7, 7, 7]);
    assert_eq!(data(2)?, "{\"milestone\":7,\"serial\":1}");
    assert_eq!(data(3)?, "{\"milestone\":7,\"serial\":2}");
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
    assert_eq!(data(4)?, "{\"milestone\":8,\"serial\":1}");
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
