use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::id::AlkaneId;
use alkanes_support::parcel::AlkaneTransferParcel;
use alkanes_support::response::CallResponse;
use anyhow::Result;
use responder_kit::Answers;
use rewards_core::opcode::collectible;
use rewards_core::policy;

use crate::GameRewards;

/// A call whose target block is 6 creates an instance of the template at `{4, tx}`.
const CREATE_FROM_TEMPLATE: u128 = 6;

impl GameRewards {
    /// Counts the claim against the claimant, numbers it within the milestone, and creates the
    /// collectible from the template. The new collectible's token comes back in the response, so
    /// it lands wherever the transaction sends this call's result.
    pub(crate) fn claim(&self, milestone: u128) -> Result<CallResponse> {
        let holder = self.claimant()?;
        let claimed = self.claimed(&holder, milestone);
        policy::check_claim(self.paused(), self.limit(milestone), claimed)?;
        self.set_claimed(&holder, milestone, claimed + 1);
        let serial = self.take_serial(milestone);
        let create = Cellpack {
            target: AlkaneId {
                block: CREATE_FROM_TEMPLATE,
                tx: self.template(),
            },
            inputs: vec![collectible::INITIALIZE, milestone, serial],
        };
        let created = self.call(&create, &AlkaneTransferParcel::default(), self.fuel())?;
        let mut response = self.forwarded()?;
        response.alkanes = created.alkanes;
        Ok(response)
    }
}
