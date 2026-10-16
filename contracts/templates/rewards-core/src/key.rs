use sha2::{Digest, Sha256};

/// The number the contracts know a milestone by. The platform names milestones with words; the
/// contract stores a 128-bit key, so no table of names needs to be kept or kept in order. The rule
/// is the first 16 bytes of the SHA-256 of the UTF-8 id, read as a little-endian integer, and the
/// adapter implements the same rule; `abi/milestone-key-vectors.json` holds the shared test vectors.
pub fn milestone_key(id: &str) -> u128 {
    let digest = Sha256::digest(id.as_bytes());
    u128::from_le_bytes(digest[..16].try_into().expect("16 bytes"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn keys_match_the_shared_vectors() {
        let file: Value =
            serde_json::from_str(include_str!("../../abi/milestone-key-vectors.json"))
                .expect("the vectors are JSON");
        let vectors = file["vectors"].as_array().expect("vectors");
        assert!(vectors.len() >= 4);
        for vector in vectors {
            let id = vector["id"].as_str().expect("id");
            let key: u128 = vector["key"]
                .as_str()
                .expect("key")
                .parse()
                .expect("a number");
            assert_eq!(milestone_key(id), key, "{id}");
        }
    }

    #[test]
    fn different_ids_have_different_keys() {
        assert_ne!(milestone_key("first-frost"), milestone_key("first-frosts"));
    }
}
