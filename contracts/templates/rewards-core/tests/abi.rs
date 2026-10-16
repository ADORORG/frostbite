//! The published ABI files and the opcode constants describe the same operations.

use rewards_core::opcode::{collectible, game};
use serde_json::Value;

fn operations(file: &str) -> Vec<(String, u128)> {
    let abi: Value = serde_json::from_str(file).expect("the ABI is JSON");
    abi["operations"]
        .as_array()
        .expect("operations")
        .iter()
        .map(|operation| {
            (
                operation["name"].as_str().expect("name").to_uppercase(),
                u128::from(operation["opcode"].as_u64().expect("opcode")),
            )
        })
        .collect()
}

#[test]
fn game_rewards_abi_matches_the_constants() {
    let expected = [
        ("INITIALIZE", game::INITIALIZE),
        ("CLAIM", game::CLAIM),
        ("DEFINE_MILESTONE", game::DEFINE_MILESTONE),
        ("PAUSE", game::PAUSE),
        ("RESUME", game::RESUME),
        ("GET_NAME", game::GET_NAME),
        ("GET_CLAIMED", game::GET_CLAIMED),
        ("GET_LIMIT", game::GET_LIMIT),
        ("GET_MILESTONE_ART", game::GET_MILESTONE_ART),
        ("GET_PAUSED", game::GET_PAUSED),
    ];
    let published = operations(include_str!("../../abi/game-rewards@1.json"));
    let expected: Vec<_> = expected
        .iter()
        .map(|(name, code)| (name.to_string(), *code))
        .collect();
    assert_eq!(published, expected);
}

#[test]
fn collectible_abi_matches_the_constants() {
    let expected = [
        ("INITIALIZE", collectible::INITIALIZE),
        ("GET_NAME", collectible::GET_NAME),
        ("GET_SYMBOL", collectible::GET_SYMBOL),
        ("GET_TOTAL_SUPPLY", collectible::GET_TOTAL_SUPPLY),
        ("GET_DATA", collectible::GET_DATA),
        ("GET_CONTENT_TYPE", collectible::GET_CONTENT_TYPE),
        ("GET_ATTRIBUTES", collectible::GET_ATTRIBUTES),
    ];
    let published = operations(include_str!("../../abi/milestone-collectible@1.json"));
    let expected: Vec<_> = expected
        .iter()
        .map(|(name, code)| (name.to_string(), *code))
        .collect();
    assert_eq!(published, expected);
}

#[test]
fn no_opcode_is_used_twice_within_a_contract() {
    for file in [
        include_str!("../../abi/game-rewards@1.json"),
        include_str!("../../abi/milestone-collectible@1.json"),
    ] {
        let mut codes: Vec<_> = operations(file).into_iter().map(|(_, code)| code).collect();
        codes.sort_unstable();
        let before = codes.len();
        codes.dedup();
        assert_eq!(codes.len(), before);
    }
}
