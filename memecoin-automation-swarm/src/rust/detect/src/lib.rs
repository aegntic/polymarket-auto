use shared::{Chain, Classification, ClassificationResult, CloneStrategy, TokenObservation};

pub fn classify(_token: &TokenObservation) -> anyhow::Result<ClassificationResult> {
    todo!("ML classifier not yet implemented")
}

pub fn extract_features(_token: &TokenObservation) -> Vec<f64> {
    todo!("feature extraction not yet implemented")
}
