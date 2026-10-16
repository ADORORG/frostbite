//! The three ways a call in these contracts answers, written once.

use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::response::CallResponse;
use anyhow::Result;

pub trait Answers: AlkaneResponder {
    /// Hands the incoming alkanes back to the caller. Every answer starts here, so a token
    /// presented with a call (the auth token) is always returned with it.
    fn forwarded(&self) -> Result<CallResponse> {
        Ok(CallResponse::forward(&self.context()?.incoming_alkanes))
    }

    /// A view's answer: the incoming alkanes back, and `data` as the result.
    fn answer(&self, data: Vec<u8>) -> Result<CallResponse> {
        let mut response = self.forwarded()?;
        response.data = data;
        Ok(response)
    }

    /// A number as views return it: sixteen bytes, little endian.
    fn number(&self, value: u128) -> Result<CallResponse> {
        self.answer(value.to_le_bytes().to_vec())
    }
}
