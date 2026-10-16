use sha2::{Digest, Sha256};

/// Who a claim is counted against: the SHA-256 of the script the claim transaction pays to at
/// output 0. Views cannot see a transaction, so a holder crosses the call boundary as two u128
/// halves, the shape `merkle-distributor` uses for its root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Holder([u8; 32]);

impl Holder {
    pub fn from_script(script: &[u8]) -> Self {
        Self(Sha256::digest(script).into())
    }

    pub fn from_halves(first: u128, second: u128) -> Self {
        let mut bytes = [0u8; 32];
        bytes[..16].copy_from_slice(&first.to_le_bytes());
        bytes[16..].copy_from_slice(&second.to_le_bytes());
        Self(bytes)
    }

    pub fn halves(&self) -> (u128, u128) {
        let first = u128::from_le_bytes(self.0[..16].try_into().expect("16 bytes"));
        let second = u128::from_le_bytes(self.0[16..].try_into().expect("16 bytes"));
        (first, second)
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn halves_round_trip() {
        let holder = Holder::from_script(b"script");
        let (first, second) = holder.halves();
        assert_eq!(Holder::from_halves(first, second), holder);
    }

    #[test]
    fn different_scripts_are_different_holders() {
        assert_ne!(Holder::from_script(b"a"), Holder::from_script(b"b"));
    }

    #[test]
    fn halves_match_the_shared_vectors() {
        let file: serde_json::Value =
            serde_json::from_str(include_str!("../../abi/holder-vectors.json")).expect("JSON");
        for vector in file["vectors"].as_array().expect("vectors") {
            let script: Vec<u8> = (0..vector["script"].as_str().expect("script").len())
                .step_by(2)
                .map(|at| {
                    u8::from_str_radix(&vector["script"].as_str().expect("script")[at..at + 2], 16)
                        .expect("hex")
                })
                .collect();
            let (first, second) = Holder::from_script(&script).halves();
            assert_eq!(first.to_string(), vector["first"].as_str().expect("first"));
            assert_eq!(
                second.to_string(),
                vector["second"].as_str().expect("second")
            );
        }
    }

    #[test]
    fn the_digest_is_sha256() {
        // SHA-256 of the empty string.
        let expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let hex: String = Holder::from_script(b"")
            .as_bytes()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(hex, expected);
    }
}
