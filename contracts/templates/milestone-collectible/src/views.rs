use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::cellpack::Cellpack;
use alkanes_support::parcel::AlkaneTransferParcel;
use alkanes_support::response::CallResponse;
use anyhow::Result;
use responder_kit::Answers;
use rewards_core::{art, attributes, opcode, render};

use crate::Collectible;

impl Collectible {
    pub(crate) fn get_name(&self) -> Result<CallResponse> {
        self.answer(b"Milestone".to_vec())
    }

    pub(crate) fn get_symbol(&self) -> Result<CallResponse> {
        self.answer(b"MILE".to_vec())
    }

    pub(crate) fn get_total_supply(&self) -> Result<CallResponse> {
        self.number(1)
    }

    pub(crate) fn get_content_type(&self) -> Result<CallResponse> {
        self.answer(render::CONTENT_TYPE.as_bytes().to_vec())
    }

    pub(crate) fn get_attributes(&self) -> Result<CallResponse> {
        let origin = self.origin()?;
        let json = attributes::json(
            origin.game.block,
            origin.game.tx,
            origin.milestone,
            origin.serial,
        );
        self.answer(json.into_bytes())
    }

    /// The picture. The drawing is asked of the issuing game each time, so one stored copy serves
    /// every collectible of the milestone.
    pub(crate) fn get_data(&self) -> Result<CallResponse> {
        let origin = self.origin()?;
        let ask = Cellpack {
            target: origin.game,
            inputs: vec![opcode::game::GET_MILESTONE_ART, origin.milestone],
        };
        let stored = self.staticcall(&ask, &AlkaneTransferParcel::default(), self.fuel())?;
        // The game validated the drawing when it was defined; validating again costs little and
        // keeps an unvalidated drawing from ever being framed.
        let drawing = art::validate(&stored.data, stored.data.len()).unwrap_or(None);
        let picture = render::frame::picture(drawing, origin.milestone, origin.serial);
        self.answer(picture.into_bytes())
    }
}
