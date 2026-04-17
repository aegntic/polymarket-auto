#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Chain, CircuitBreakerLevel, Classification, Network, SignalScore, TokenAddress};

    #[test]
    fn chain_display() {
        assert_eq!(Chain::Solana.to_string(), "solana");
        assert_eq!(Chain::Base.to_string(), "base");
        assert_eq!(Chain::Bnb.to_string(), "bnb");
    }

    #[test]
    fn network_display() {
        assert_eq!(Network::Devnet.to_string(), "devnet");
        assert_eq!(Network::Mainnet.to_string(), "mainnet");
    }

    #[test]
    fn signal_score_clamp() {
        assert_eq!(SignalScore::try_from(0).unwrap().value(), 0);
        assert_eq!(SignalScore::try_from(100).unwrap().value(), 100);
        assert!(SignalScore::try_from(101).is_err());
    }

    #[test]
    fn signal_score_is_high() {
        assert!(SignalScore(70).is_high());
        assert!(!SignalScore(69).is_high());
    }

    #[test]
    fn classification_display() {
        assert_eq!(Classification::Clone.to_string(), "clone");
        assert_eq!(Classification::Original.to_string(), "original");
    }

    #[test]
    fn event_envelope_new() {
        let env = crate::EventEnvelope::new("test", "event", serde_json::json!({"key": "val"}));
        assert_eq!(env.module, "test");
        assert_eq!(env.event_type, "event");
    }

    #[test]
    fn error_codes_defined() {
        assert!(!crate::error_codes::REDIS_CONN.is_empty());
        assert!(!crate::error_codes::CLICKHOUSE_CONN.is_empty());
        assert!(!crate::error_codes::LLM_BUDGET.is_empty());
        assert!(!crate::error_codes::CB_RED.is_empty());
    }
}
