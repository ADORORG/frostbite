use alkanes_runtime::runtime::AlkaneResponder;
use anyhow::{anyhow, Result};
use rewards_core::holder::Holder;

use crate::GameRewards;

impl GameRewards {
    /// The claimant is the script output 0 pays to. The runtime does not expose the outputs a
    /// transaction spends (`AlkaneResponder::output` is commented out upstream), so a contract
    /// cannot tell who signed an input. The rule binds the collectible to a wallet; it does not
    /// prove that wallet asked for it, so someone can claim for another wallet. ADR-018
    /// Amendment 3 accepts that for self-reported milestones.
    pub(crate) fn claimant(&self) -> Result<Holder> {
        let transaction = self.transaction_object()?;
        let output = transaction
            .output
            .first()
            .ok_or_else(|| anyhow!("transaction has no outputs"))?;
        Ok(Holder::from_script(output.script_pubkey.as_bytes()))
    }
}
