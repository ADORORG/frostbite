use alkanes::indexer::index_block;
use alkanes::precompiled::alkanes_std_auth_token_build;
use alkanes::tests::helpers as h;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::constants::AUTH_TOKEN_FACTORY_ID;
use alkanes_support::envelope::RawEnvelope;
use alkanes_support::id::AlkaneId;
use bitcoin::{Amount, Block, OutPoint, ScriptBuf, Sequence, Transaction, TxIn, TxOut, Witness};
use protorune::test_helpers::{get_address, ADDRESS1, ADDRESS2};
use protorune_support::balance_sheet::{BalanceSheetOperations, ProtoruneRuneId};
use protorune_support::protostone::Protostone;
use rewards_core::holder::Holder;
use rewards_core::opcode::game;

use super::{COLLECTIBLE, MAX_ART, REWARDS, TEMPLATE};

/// A claim is made to the script output 0 pays to, so a wallet is just a script.
#[derive(Clone, Copy)]
pub enum Wallet {
    A,
    B,
}

impl Wallet {
    pub fn script(self) -> ScriptBuf {
        let address = match self {
            Wallet::A => ADDRESS1(),
            Wallet::B => ADDRESS2(),
        };
        get_address(&address).script_pubkey()
    }

    pub fn holder(self) -> Holder {
        Holder::from_script(self.script().as_bytes())
    }
}

/// A transaction added to the block: where it sits and where its call's trace is recorded.
#[derive(Clone, Copy)]
pub struct Sent {
    pub index: usize,
    pub trace: OutPoint,
}

/// The block under construction and the output that holds the game's auth token, which each
/// administration transaction spends and gets back.
pub struct Chain {
    block: Block,
    admin_tip: OutPoint,
    // Transactions with the same inputs, outputs and call have the same id, and a trace is stored
    // by transaction id, so every transaction that spends nothing real spends its own made-up output.
    spent_nothing: u32,
}

fn cellpack(target: (u128, u128), inputs: Vec<u128>) -> Cellpack {
    Cellpack {
        target: AlkaneId {
            block: target.0,
            tx: target.1,
        },
        inputs,
    }
}

fn spent(outpoint: OutPoint, witness: Witness) -> TxIn {
    TxIn {
        previous_output: outpoint,
        script_sig: ScriptBuf::new(),
        sequence: Sequence::MAX,
        witness,
    }
}

impl Chain {
    /// The auth-token factory, the collectible template, and the game, initialised. The game's
    /// auth token comes back to output 0 of the last transaction.
    pub fn deploy() -> Self {
        h::clear();
        let block = h::init_with_multiple_cellpacks_with_tx(
            vec![
                alkanes_std_auth_token_build::get_bytes(),
                COLLECTIBLE.to_vec(),
                REWARDS.to_vec(),
            ],
            vec![
                cellpack((3, AUTH_TOKEN_FACTORY_ID), vec![100]),
                cellpack((3, TEMPLATE), vec![]),
                cellpack((1, 0), vec![game::INITIALIZE, TEMPLATE, MAX_ART]),
            ],
        );
        let admin_tip = OutPoint {
            txid: block.txdata[block.txdata.len() - 1].compute_txid(),
            vout: 0,
        };
        Self {
            block,
            admin_tip,
            spent_nothing: 0,
        }
    }

    /// The game's initialisation transaction, where its auth token first lands.
    pub fn initialisation(&self) -> Sent {
        let index = self.block.txdata.len() - 1;
        self.sent(index)
    }

    fn sent(&self, index: usize) -> Sent {
        Sent {
            index,
            trace: OutPoint {
                txid: self.block.txdata[index].compute_txid(),
                // Two real outputs (the wallet and the OP_RETURN), then the one protostone.
                vout: 3,
            },
        }
    }

    fn push(&mut self, input: TxIn, to: Wallet, call: Cellpack) -> Sent {
        let output = TxOut {
            value: Amount::from_sat(1000),
            script_pubkey: to.script(),
        };
        let stone = Protostone {
            burn: None,
            message: call.encipher(),
            edicts: vec![],
            refund: Some(0),
            pointer: Some(0),
            from: None,
            protocol_tag: 1,
        };
        let transaction: Transaction =
            h::create_protostone_tx_with_inputs(vec![input], vec![output], stone);
        self.block.txdata.push(transaction);
        self.sent(self.block.txdata.len() - 1)
    }

    /// A call to the game made with the auth token. A drawing, if given, goes in the witness.
    pub fn admin(&mut self, inputs: Vec<u128>, drawing: Option<&[u8]>) -> Sent {
        let witness = drawing.map_or_else(Witness::new, |bytes| {
            RawEnvelope::from(bytes.to_vec()).to_witness(false)
        });
        let input = spent(self.admin_tip, witness);
        let sent = self.push(input, Wallet::A, cellpack(super::GAME, inputs));
        self.admin_tip = OutPoint {
            txid: self.block.txdata[sent.index].compute_txid(),
            vout: 0,
        };
        sent
    }

    fn made_up_input(&mut self) -> TxIn {
        self.spent_nothing += 1;
        let outpoint = OutPoint {
            vout: self.spent_nothing,
            ..OutPoint::null()
        };
        spent(outpoint, Witness::new())
    }

    pub fn define(&mut self, milestone: u128, limit: u128, drawing: Option<&[u8]>) -> Sent {
        self.admin(vec![game::DEFINE_MILESTONE, milestone, limit], drawing)
    }

    pub fn pause(&mut self) -> Sent {
        self.admin(vec![game::PAUSE], None)
    }

    pub fn resume(&mut self) -> Sent {
        self.admin(vec![game::RESUME], None)
    }

    /// A call to the game by someone who does not hold the auth token.
    pub fn stranger(&mut self, inputs: Vec<u128>) -> Sent {
        let input = self.made_up_input();
        self.push(input, Wallet::B, cellpack(super::GAME, inputs))
    }

    /// `wallet` claims `milestone`; the collectible is sent to that wallet's script.
    pub fn claim(&mut self, wallet: Wallet, milestone: u128) -> Sent {
        let input = self.made_up_input();
        self.push(
            input,
            wallet,
            cellpack(super::GAME, vec![game::CLAIM, milestone]),
        )
    }

    /// Indexes everything added so far; call once, after the last transaction.
    pub fn index(&self) {
        index_block(&self.block, 880_000).expect("the block indexes");
    }

    /// How much of an alkane the first output of a transaction holds.
    pub fn held(&self, sent: Sent, alkane: (u128, u128)) -> u128 {
        let sheet = h::get_sheet_for_outpoint(&self.block, sent.index, 0).expect("a balance sheet");
        sheet.get(&ProtoruneRuneId {
            block: alkane.0,
            tx: alkane.1,
        })
    }
}
