use crate::aggregator::helius::{TxSummary, TxType};

#[derive(Debug, Clone)]
pub enum RedFlag {
    CopyTradeBot,
    KOLFrontRun,
    BotFarm,
    JitoBundler,
    SuspiciousNewWallet,
    RegularTradeInterval,
}

pub fn has_red_flags(_wallet: &str, recent_txs: &[TxSummary]) -> Vec<RedFlag> {
    let mut flags = vec![];

    // Check for suspiciously regular trade intervals (bot pattern)
    if recent_txs.len() >= 5 {
        let timestamps: Vec<u64> = recent_txs.iter()
            .filter(|t| matches!(t.tx_type, TxType::Swap))
            .map(|t| t.timestamp)
            .collect();

        if timestamps.len() >= 4 {
            let mut intervals: Vec<u64> = Vec::new();
            for window in timestamps.windows(2) {
                intervals.push(window[1].abs_diff(window[0]));
            }

            // If >60% of intervals are within 10% of the median, flag as bot
            if !intervals.is_empty() {
                let mut sorted = intervals.clone();
                sorted.sort();
                let median = sorted[sorted.len() / 2];

                if median > 0 {
                    let regular_count = intervals.iter()
                        .filter(|&&i| (i as f64 - median as f64).abs() / (median as f64) < 0.10)
                        .count();

                    if regular_count as f64 / intervals.len() as f64 > 0.6 {
                        flags.push(RedFlag::RegularTradeInterval);
                    }
                }
            }
        }
    }

    // Check for only Unknown tx types (suspicious — real wallets have swaps/transfers)
    let known_types: Vec<_> = recent_txs.iter()
        .filter(|t| !matches!(t.tx_type, TxType::Unknown))
        .collect();
    if recent_txs.len() >= 10 && known_types.is_empty() {
        flags.push(RedFlag::BotFarm);
    }

    flags
}
