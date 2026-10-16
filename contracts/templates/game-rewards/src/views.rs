use alkanes_runtime::auth::AuthenticatedResponder;
use alkanes_support::response::CallResponse;
use anyhow::Result;
use responder_kit::Answers;
use rewards_core::holder::Holder;

use crate::GameRewards;

impl GameRewards {
    pub(crate) fn get_name(&self) -> Result<CallResponse> {
        self.answer(b"game-rewards".to_vec())
    }

    pub(crate) fn get_claimed(
        &self,
        holder_first_half: u128,
        holder_second_half: u128,
        milestone: u128,
    ) -> Result<CallResponse> {
        let holder = Holder::from_halves(holder_first_half, holder_second_half);
        self.number(self.claimed(&holder, milestone))
    }

    pub(crate) fn get_limit(&self, milestone: u128) -> Result<CallResponse> {
        self.number(self.limit(milestone))
    }

    pub(crate) fn get_milestone_art(&self, milestone: u128) -> Result<CallResponse> {
        self.answer(self.art(milestone))
    }

    pub(crate) fn get_auth_token(&self) -> Result<CallResponse> {
        let token = self.auth_token()?;
        let mut data = token.block.to_le_bytes().to_vec();
        data.extend(token.tx.to_le_bytes());
        self.answer(data)
    }

    pub(crate) fn get_paused(&self) -> Result<CallResponse> {
        self.number(u128::from(self.paused()))
    }
}
