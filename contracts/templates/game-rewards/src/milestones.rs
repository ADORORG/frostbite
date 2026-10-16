use alkanes_runtime::auth::AuthenticatedResponder;
use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::response::CallResponse;
use alkanes_support::witness::find_witness_payload;
use anyhow::Result;
use responder_kit::Answers;
use rewards_core::{art, policy};

use crate::GameRewards;

impl GameRewards {
    /// Defines a milestone: its per-wallet claim limit and, optionally, its drawing, which travels
    /// in the transaction witness because the call sits in the `OP_RETURN`, which relays carry
    /// only to about 80 bytes. The witness envelope must be uncompressed: `find_witness_payload`
    /// does not decompress. A milestone is never edited after it is defined, so what players
    /// claimed stays what they saw.
    pub(crate) fn define_milestone(&self, milestone: u128, limit: u128) -> Result<CallResponse> {
        self.only_owner()?;
        policy::check_definition(self.limit(milestone), limit)?;
        let transaction = self.transaction_object()?;
        let payload = find_witness_payload(&transaction, 0).unwrap_or_default();
        let max = usize::try_from(self.max_art_bytes()).unwrap_or(usize::MAX);
        art::validate(&payload, max)?;
        self.set_limit(milestone, limit);
        if !payload.is_empty() {
            self.set_art(milestone, payload);
        }
        self.forwarded()
    }
}
