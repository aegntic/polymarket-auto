use anyhow::{Context, Result};
use shared::redis_client::RedisPool;
use shared::{
    Classification, ClassificationResult, CloneStrategy, EventEnvelope, TokenObservation,
    CHANNEL_DETECT_RESULTS, CHANNEL_RECON_SIGNALS,
};
use tracing::{debug, error, info, warn};

// Known token names used for clone detection via Levenshtein distance.
const KNOWN_TOKENS: &[&str] = &[
    "dogecoin",
    "shiba inu",
    "pepe",
    "bonk",
    "wojak",
    "floki",
];

// Distance threshold below which a token is classified as a clone.
const CLONE_DISTANCE_THRESHOLD: usize = 3;

/// Compute Levenshtein edit distance between two strings using standard DP.
/// Case-insensitive comparison.
fn levenshtein(a: &str, b: &str) -> usize {
    let a = a.to_lowercase();
    let b = b.to_lowercase();
    let a_len = a.chars().count();
    let b_len = b.chars().count();

    if a_len == 0 {
        return b_len;
    }
    if b_len == 0 {
        return a_len;
    }

    let mut prev = vec![0usize; b_len + 1];
    let mut curr = vec![0usize; b_len + 1];

    for j in 0..=b_len {
        prev[j] = j;
    }

    let mut a_chars = a.chars();
    for i in 1..=a_len {
        curr[0] = i;
        let a_ch = a_chars.next().expect("loop bound guarantees char exists");
        let mut b_chars = b.chars();
        for j in 1..=b_len {
            let b_ch = b_chars.next().expect("loop bound guarantees char exists");
            let cost = if a_ch == b_ch { 0 } else { 1 };
            curr[j] = (prev[j] + 1)       // deletion
                .min(curr[j - 1] + 1)      // insertion
                .min(prev[j - 1] + cost);  // substitution
        }
        std::mem::swap(&mut prev, &mut curr);
    }

    prev[b_len]
}

/// Find the minimum Levenshtein distance between the token name and any known
/// token, returning (min_distance, matching_known_token).
fn min_distance_to_known(name: &str) -> (usize, Option<&'static str>) {
    let mut best_dist = usize::MAX;
    let mut best_match: Option<&'static str> = None;

    for &known in KNOWN_TOKENS {
        let d = levenshtein(name, known);
        if d < best_dist {
            best_dist = d;
            best_match = Some(known);
        }
    }

    (best_dist, best_match)
}

/// Determine the clone strategy based on how the name differs from the original.
fn infer_clone_strategy(name: &str, original: &str) -> CloneStrategy {
    let name_lower = name.to_lowercase();
    let orig_lower = original.to_lowercase();

    // Check for suffix additions (e.g., "dogecoin2", "pepecoin")
    if name_lower.starts_with(&orig_lower) && name_lower.len() > orig_lower.len() {
        return CloneStrategy::Suffix;
    }

    // Check for homophone patterns: common character substitutions
    let homophone_pairs: &[(&str, &str)] = &[
        ("0", "o"), ("1", "l"), ("1", "i"), ("3", "e"), ("4", "a"),
        ("5", "s"), ("8", "b"), ("rn", "m"), ("nn", "m"),
    ];
    let mut stripped = name_lower.clone();
    for &(fake, real) in homophone_pairs {
        stripped = stripped.replace(fake, real);
    }
    if stripped != name_lower && levenshtein(&stripped, &orig_lower) < CLONE_DISTANCE_THRESHOLD {
        return CloneStrategy::Homophone;
    }

    // Check for unicode-like characters (non-ASCII that looks like ASCII)
    if name.chars().any(|c| c as u32 > 127) {
        return CloneStrategy::Unicode;
    }

    CloneStrategy::Substitution
}

/// Classify a token observation using rule-based detection.
///
/// Compares the token name against known tokens via Levenshtein distance.
/// Short symbols get a confidence penalty.
pub fn classify(token: &TokenObservation) -> Result<ClassificationResult> {
    let (min_dist, matched_known) = min_distance_to_known(&token.name);

    let (classification, confidence, clone_strategy, original_token, reasoning) =
        if min_dist < CLONE_DISTANCE_THRESHOLD {
            // Confidence: 1.0 at distance 0, decreasing as distance grows.
            // At distance 0 it is an exact name match -> very high confidence.
            // At distance 1 -> 0.9, distance 2 -> 0.75.
            let base_confidence: f64 = match min_dist {
                0 => 1.0_f64,
                1 => 0.9_f64,
                2 => 0.75_f64,
                _ => 0.6_f64,
            };

            // Penalize very short symbols (likely low-effort clones).
            let symbol_penalty: f64 = if token.symbol.len() < 3 { 0.15_f64 } else { 0.0_f64 };
            let confidence: f64 = (base_confidence - symbol_penalty).max(0.0_f64);

            let strategy = infer_clone_strategy(&token.name, matched_known.unwrap_or(""));
            let original = matched_known.unwrap_or("unknown").to_string();
            let reason = format!(
                "Name '{}' is distance {} from known token '{}' (strategy: {:?})",
                token.name, min_dist, original, strategy
            );

            (Classification::Clone, confidence, Some(strategy), Some(original), reason)
        } else {
            // No close match found among known tokens.
            let reason = format!(
                "Name '{}' has min distance {} from all known tokens (threshold: {})",
                token.name, min_dist, CLONE_DISTANCE_THRESHOLD
            );
            (Classification::Original, 0.6, None, None, reason)
        };

    Ok(ClassificationResult {
        token_address: token.token_address.clone(),
        chain: token.chain,
        classification,
        confidence,
        clone_strategy,
        original_token,
        reasoning,
        model_used: Some("rule-based-v1".to_string()),
        classified_at: chrono::Utc::now(),
        cost_usd: 0.0,
    })
}

/// Extract numerical features from a token observation for downstream ML use.
///
/// Returns a vector of:
///   [0] name length (chars)
///   [1] symbol length (chars)
///   [2] name contains digit (1.0 / 0.0)
///   [3] symbol contains digit (1.0 / 0.0)
///   [4] levenshtein min distance to known tokens (as f64)
pub fn extract_features(token: &TokenObservation) -> Vec<f64> {
    let (min_dist, _) = min_distance_to_known(&token.name);

    vec![
        token.name.chars().count() as f64,
        token.symbol.chars().count() as f64,
        if token.name.chars().any(|c| c.is_ascii_digit()) { 1.0 } else { 0.0 },
        if token.symbol.chars().any(|c| c.is_ascii_digit()) { 1.0 } else { 0.0 },
        min_dist as f64,
    ]
}

/// The detect service subscribes to recon signals, classifies each token,
/// and publishes classification results.
pub struct DetectService {
    redis: RedisPool,
}

impl DetectService {
    pub fn new(redis: RedisPool) -> Self {
        Self { redis }
    }

    /// Start the detect service loop. Subscribes to CHANNEL_RECON_SIGNALS,
    /// deserializes each TokenObservation, runs classify(), and publishes
    /// the ClassificationResult to CHANNEL_DETECT_RESULTS.
    pub async fn start(&mut self) -> Result<()> {
        info!("DETECT service starting, subscribing to {}", CHANNEL_RECON_SIGNALS);

        // Open a dedicated connection for subscribing (pub/sub needs its own conn).
        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
        let sub_client = redis::Client::open(&*redis_url)
            .context("detect: failed to create subscriber Redis client")?;
        let mut pubsub_conn = sub_client
            .get_async_pubsub()
            .await
            .context("detect: failed to open async pubsub connection")?;

        pubsub_conn
            .subscribe(CHANNEL_RECON_SIGNALS)
            .await
            .context("detect: failed to subscribe to recon signals channel")?;

        info!("DETECT subscribed to {}, waiting for messages", CHANNEL_RECON_SIGNALS);

        use futures_util::stream::StreamExt;
        let mut message_stream = pubsub_conn.on_message();

        while let Some(msg) = message_stream.next().await {
            let payload: String = match msg.get_payload::<String>() {
                Ok(p) => p,
                Err(e) => {
                    warn!("detect: failed to decode pubsub payload: {}", e);
                    continue;
                }
            };

            debug!("detect: received message ({} bytes)", payload.len());

            // The recon service publishes an EventEnvelope-wrapped TokenObservation
            // or a raw JSON payload. Try EventEnvelope first, fall back to direct
            // TokenObservation.
            let token_obs = if let Ok(envelope) = serde_json::from_str::<EventEnvelope>(&payload) {
                match serde_json::from_value::<TokenObservation>(envelope.payload) {
                    Ok(obs) => obs,
                    Err(e) => {
                        warn!("detect: failed to deserialize TokenObservation from envelope: {}", e);
                        continue;
                    }
                }
            } else {
                match serde_json::from_str::<TokenObservation>(&payload) {
                    Ok(obs) => obs,
                    Err(e) => {
                        warn!("detect: failed to deserialize TokenObservation directly: {}", e);
                        continue;
                    }
                }
            };

            let token_addr = token_obs.token_address.clone();
            let token_name = token_obs.name.clone();

            match classify(&token_obs) {
                Ok(result) => {
                    let classification = result.classification;
                    let confidence = result.confidence;
                    debug!(
                        token = %token_addr,
                        name = %token_name,
                        classification = %classification,
                        confidence = %confidence,
                        "detect: classified token"
                    );

                    let event = EventEnvelope::new(
                        "detect",
                        "classification",
                        serde_json::to_value(&result)
                            .unwrap_or_else(|_| serde_json::json!({"error": "serialize failed"})),
                    );

                    if let Err(e) = self.redis.publish(CHANNEL_DETECT_RESULTS, &event).await {
                        error!(
                            token = %token_addr,
                            error = %e,
                            "detect: failed to publish classification result"
                        );
                    }
                }
                Err(e) => {
                    error!(
                        token = %token_addr,
                        error = %e,
                        "detect: classification failed"
                    );
                }
            }
        }

        info!("DETECT service message stream ended");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use shared::Chain;

    fn make_obs(name: &str, symbol: &str) -> TokenObservation {
        TokenObservation {
            token_address: "test_addr".to_string(),
            chain: Chain::Solana,
            name: name.to_string(),
            symbol: symbol.to_string(),
            decimals: 6,
            supply: Some("1000000000".to_string()),
            creator_address: None,
            creation_tx: None,
            created_at: Utc::now(),
            metadata_uri: None,
            logo_uri: None,
            initial_liquidity_sol: None,
            initial_market_cap_usd: None,
            holder_count_1h: None,
            volume_1h: None,
            signal_score: None,
        }
    }

    #[test]
    fn levenshtein_exact_match() {
        assert_eq!(levenshtein("dogecoin", "dogecoin"), 0);
        assert_eq!(levenshtein("PEPE", "pepe"), 0);
    }

    #[test]
    fn levenshtein_one_edit() {
        assert_eq!(levenshtein("dogecain", "dogecoin"), 1);
        assert_eq!(levenshtein("peee", "pepe"), 1);
    }

    #[test]
    fn levenshtein_two_edits() {
        assert_eq!(levenshtein("dogecoon", "dogecoin"), 1); // o->i is 1
        assert_eq!(levenshtein("shaba inu", "shiba inu"), 1);
    }

    #[test]
    fn classify_exact_clone() {
        let obs = make_obs("dogecoin", "DOGE");
        let result = classify(&obs).unwrap();
        assert_eq!(result.classification, Classification::Clone);
        assert!(result.confidence >= 0.99);
        assert!(result.original_token.is_some());
    }

    #[test]
    fn classify_near_clone() {
        let obs = make_obs("dogecoin2", "DG2");
        let result = classify(&obs).unwrap();
        assert_eq!(result.classification, Classification::Clone);
        assert!(result.confidence >= 0.5);
    }

    #[test]
    fn classify_original() {
        let obs = make_obs("totally_unique_moon", "MOON");
        let result = classify(&obs).unwrap();
        assert_eq!(result.classification, Classification::Original);
    }

    #[test]
    fn classify_short_symbol_penalty() {
        let obs_short = make_obs("dogecoin", "DG");
        let obs_normal = make_obs("dogecoin", "DOGE");
        let r_short = classify(&obs_short).unwrap();
        let r_normal = classify(&obs_normal).unwrap();
        assert!(r_short.confidence < r_normal.confidence);
    }

    #[test]
    fn extract_features_shape() {
        let obs = make_obs("pepe123", "PP");
        let feats = extract_features(&obs);
        assert_eq!(feats.len(), 5);
        // name length "pepe123" = 7
        assert_eq!(feats[0], 7.0);
        // symbol length "PP" = 2
        assert_eq!(feats[1], 2.0);
        // name has digit -> 1.0
        assert_eq!(feats[2], 1.0);
        // symbol has no digit -> 0.0
        assert_eq!(feats[3], 0.0);
        // min distance: "pepe123" vs "pepe" = 3 (inserts "1","2","3")
        assert_eq!(feats[4], 3.0);
    }

    #[test]
    fn extract_features_no_digit() {
        let obs = make_obs("moonshot", "MSN");
        let feats = extract_features(&obs);
        assert_eq!(feats[2], 0.0); // no digit in name
        assert_eq!(feats[3], 0.0); // no digit in symbol
    }

    #[test]
    fn clone_strategy_suffix() {
        // "dogecoinz" is distance 1 from "dogecoin" (append "z"), under threshold.
        // It starts with "dogecoin" so strategy should be Suffix.
        let obs = make_obs("dogecoinz", "DGZ");
        let result = classify(&obs).unwrap();
        assert_eq!(result.classification, Classification::Clone);
        assert_eq!(result.clone_strategy, Some(CloneStrategy::Suffix));
    }

    #[test]
    fn clone_strategy_homophone() {
        let obs = make_obs("d0gecoin", "DG");
        let result = classify(&obs).unwrap();
        // "d0gecoin" has 0->o substitution, should detect Homophone
        if result.classification == Classification::Clone {
            assert!(result.clone_strategy.is_some());
        }
    }
}
