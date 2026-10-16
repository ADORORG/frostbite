use crate::render::text;

/// What `get-attributes` returns: the game that issued the collectible, the milestone it records
/// and its edition number within that milestone. Numbers are written in decimal so any reader can
/// parse them without a 128-bit type.
pub fn json(game_block: u128, game_tx: u128, milestone: u128, serial: u128) -> String {
    let mut out = String::from("{\"game\":\"");
    text::push_u128(&mut out, game_block);
    out.push(':');
    text::push_u128(&mut out, game_tx);
    out.push_str("\",\"milestone\":\"");
    text::push_u128(&mut out, milestone);
    out.push_str("\",\"serial\":");
    text::push_u128(&mut out, serial);
    out.push('}');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attributes_are_json_with_decimal_numbers() {
        assert_eq!(
            json(2, 5, 340282366920938463463374607431768211455, 12),
            "{\"game\":\"2:5\",\"milestone\":\"340282366920938463463374607431768211455\",\"serial\":12}"
        );
    }
}
