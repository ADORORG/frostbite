mod support;

use alkanes::indexer::index_block;
use alkanes::tests::helpers as h;
use bitcoin::{Amount, OutPoint, ScriptBuf, Sequence, TxIn, TxOut, Witness};
use protorune_support::balance_sheet::{BalanceSheetOperations, ProtoruneRuneId};
use protorune_support::protostone::{Protostone, ProtostoneEdict};
use support::{Chain, Wallet, FIRST_COLLECTIBLE};
use wasm_bindgen_test::wasm_bindgen_test;

/// Records a limit of the design (ADR-018 Amendment 3): the runtime moves balances without
/// calling the contract, so a collectible cannot be locked to the wallet that claimed it.
#[wasm_bindgen_test]
fn a_collectible_moves_without_the_contract_being_called() -> anyhow::Result<()> {
    let mut chain = Chain::deploy();
    chain.define(7, 1, None);
    let claim = chain.claim(Wallet::A, 7);
    chain.index();
    assert_eq!(chain.held(claim, (2, FIRST_COLLECTIBLE)), 1);

    let held = OutPoint {
        txid: claim.trace.txid,
        vout: 0,
    };
    let stone = Protostone {
        burn: None,
        message: vec![],
        edicts: vec![ProtostoneEdict {
            id: ProtoruneRuneId {
                block: 2,
                tx: FIRST_COLLECTIBLE,
            },
            amount: 1,
            output: 0,
        }],
        refund: Some(0),
        pointer: Some(0),
        from: None,
        protocol_tag: 1,
    };
    let to = TxOut {
        value: Amount::from_sat(1000),
        script_pubkey: Wallet::B.script(),
    };
    let input = TxIn {
        previous_output: held,
        script_sig: ScriptBuf::new(),
        sequence: Sequence::MAX,
        witness: Witness::new(),
    };
    let mut next = protorune::test_helpers::create_block_with_coinbase_tx(880_001);
    next.txdata.push(h::create_protostone_tx_with_inputs(
        vec![input],
        vec![to],
        stone,
    ));
    index_block(&next, 880_001)?;
    let moved = h::get_sheet_for_outpoint(&next, 1, 0)?;
    assert_eq!(
        moved.get(&ProtoruneRuneId {
            block: 2,
            tx: FIRST_COLLECTIBLE
        }),
        1
    );
    Ok(())
}
