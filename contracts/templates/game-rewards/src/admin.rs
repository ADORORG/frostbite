use alkanes_runtime::auth::AuthenticatedResponder;
use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::response::CallResponse;
use anyhow::Result;
use responder_kit::Answers;

use crate::GameRewards;

impl GameRewards {
    /// Once: records the collectible template and the drawing limit, and hands the caller the
    /// auth token. Whoever holds that token administers the game.
    pub(crate) fn initialize(
        &self,
        collectible_template: u128,
        max_art_bytes: u128,
    ) -> Result<CallResponse> {
        self.observe_initialization()?;
        self.set_template(collectible_template);
        self.set_max_art_bytes(max_art_bytes);
        let mut response = self.forwarded()?;
        response.alkanes.0.push(self.deploy_auth_token(1)?);
        Ok(response)
    }

    pub(crate) fn pause(&self) -> Result<CallResponse> {
        self.only_owner()?;
        self.set_paused(true);
        self.forwarded()
    }

    pub(crate) fn resume(&self) -> Result<CallResponse> {
        self.only_owner()?;
        self.set_paused(false);
        self.forwarded()
    }
}
