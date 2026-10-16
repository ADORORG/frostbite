//! The rules the contracts enforce, as plain functions. A refusal's text is what the chain records
//! when the call reverts, so the platform and the tests read the same strings.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    Paused,
    UnknownMilestone,
    LimitReached,
    AlreadyDefined,
    InvalidLimit,
    ArtTooLarge,
    ArtNotSvg,
    ArtForbidden,
}

impl Refusal {
    pub fn message(&self) -> &'static str {
        match self {
            Self::Paused => "claims are paused",
            Self::UnknownMilestone => "unknown milestone",
            Self::LimitReached => "claim limit reached",
            Self::AlreadyDefined => "milestone already defined",
            Self::InvalidLimit => "claim limit must be at least one",
            Self::ArtTooLarge => "art too large",
            Self::ArtNotSvg => "art is not a single svg document",
            Self::ArtForbidden => "art contains forbidden content",
        }
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message())
    }
}

impl std::error::Error for Refusal {}

/// A claim goes through when claims are open, the milestone exists (its limit is set) and the
/// holder has claimed it fewer times than the limit.
pub fn check_claim(paused: bool, limit: u128, claimed: u128) -> Result<(), Refusal> {
    if paused {
        return Err(Refusal::Paused);
    }
    if limit == 0 {
        return Err(Refusal::UnknownMilestone);
    }
    if claimed >= limit {
        return Err(Refusal::LimitReached);
    }
    Ok(())
}

/// A milestone is defined once and never edited, so what players claimed stays what it was.
pub fn check_definition(existing_limit: u128, limit: u128) -> Result<(), Refusal> {
    if existing_limit != 0 {
        return Err(Refusal::AlreadyDefined);
    }
    if limit == 0 {
        return Err(Refusal::InvalidLimit);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_claim_below_the_limit_goes_through() {
        assert_eq!(check_claim(false, 2, 1), Ok(()));
    }

    #[test]
    fn a_claim_at_the_limit_is_refused() {
        assert_eq!(check_claim(false, 2, 2), Err(Refusal::LimitReached));
        assert_eq!(check_claim(false, 2, 3), Err(Refusal::LimitReached));
    }

    #[test]
    fn a_paused_game_refuses_before_anything_else() {
        assert_eq!(check_claim(true, 0, 0), Err(Refusal::Paused));
    }

    #[test]
    fn an_undefined_milestone_is_unknown() {
        assert_eq!(check_claim(false, 0, 0), Err(Refusal::UnknownMilestone));
    }

    #[test]
    fn a_milestone_is_defined_once_with_a_limit() {
        assert_eq!(check_definition(0, 1), Ok(()));
        assert_eq!(check_definition(3, 1), Err(Refusal::AlreadyDefined));
        assert_eq!(check_definition(0, 0), Err(Refusal::InvalidLimit));
    }

    #[test]
    fn a_refusal_displays_as_its_message_and_is_an_error() {
        let refusal = Refusal::LimitReached;
        assert_eq!(refusal.to_string(), refusal.message());
        let error: Box<dyn std::error::Error> = Box::new(refusal);
        assert_eq!(error.to_string(), "claim limit reached");
    }

    #[test]
    fn every_refusal_has_its_own_message() {
        let all = [
            Refusal::Paused,
            Refusal::UnknownMilestone,
            Refusal::LimitReached,
            Refusal::AlreadyDefined,
            Refusal::InvalidLimit,
            Refusal::ArtTooLarge,
            Refusal::ArtNotSvg,
            Refusal::ArtForbidden,
        ];
        let mut messages: Vec<_> = all.iter().map(Refusal::message).collect();
        messages.sort_unstable();
        messages.dedup();
        assert_eq!(messages.len(), all.len());
    }
}
