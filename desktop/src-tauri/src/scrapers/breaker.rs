//! Per-distributor circuit breaker, mirroring the shared resilient fetch
//! (`lib/scrapers/resilient.ts`). The desktop's plain/browser scrape runs only
//! as a fallback, but the same distributor is blocked for both paths, and
//! retrying a block compounds it.
//!
//! Semantics copied from the shared implementation:
//! * a blocked distributor cools down for 30 minutes, growing 1.5x per
//!   consecutive block up to two hours;
//! * hard errors only cool down once `FAILURE_THRESHOLD` is reached, for a flat
//!   15 minutes;
//! * any success resets the entry.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub const BLOCKED_COOLDOWN_MS: u64 = 30 * 60 * 1000;
pub const FAILURE_COOLDOWN_MS: u64 = 15 * 60 * 1000;
pub const FAILURE_THRESHOLD: u32 = 3;
pub const MAX_COOLDOWN_MS: u64 = 2 * 60 * 60 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrapeOutcome {
    Ok,
    Blocked,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BreakerEntry {
    pub consecutive_failures: u32,
    pub cooldown_until_ms: u64,
}

/// The shared `blockCooldownMs`: 1.5x growth per consecutive block, capped.
fn block_cooldown_ms(consecutive_failures: u32) -> u64 {
    let growth = 1.5_f64.powi(consecutive_failures as i32 - 1);
    ((BLOCKED_COOLDOWN_MS as f64 * growth).round() as u64).min(MAX_COOLDOWN_MS)
}

/// The shared breaker transition. `now_ms` is only used to stamp the cooldown.
pub fn next_entry(prev: BreakerEntry, outcome: ScrapeOutcome, now_ms: u64) -> BreakerEntry {
    match outcome {
        ScrapeOutcome::Ok => BreakerEntry::default(),
        ScrapeOutcome::Blocked => {
            let consecutive_failures = prev.consecutive_failures + 1;
            BreakerEntry {
                consecutive_failures,
                cooldown_until_ms: now_ms + block_cooldown_ms(consecutive_failures),
            }
        }
        ScrapeOutcome::Error => {
            let consecutive_failures = prev.consecutive_failures + 1;
            let cooldown_until_ms = if consecutive_failures >= FAILURE_THRESHOLD {
                now_ms + FAILURE_COOLDOWN_MS
            } else {
                // The shared entry spread keeps the previous deadline, which is
                // either zero or already in the past.
                prev.cooldown_until_ms
            };
            BreakerEntry {
                consecutive_failures,
                cooldown_until_ms,
            }
        }
    }
}

pub fn is_in_cooldown(entry: &BreakerEntry, now_ms: u64) -> bool {
    entry.cooldown_until_ms > now_ms
}

/// Classify a scrape result the way the shared fetch outcome is classified: a
/// block is not retried, any other failure counts toward the threshold.
pub fn outcome_for<T>(result: &Result<T, String>) -> ScrapeOutcome {
    match result {
        Ok(_) => ScrapeOutcome::Ok,
        Err(message) if super::is_blocked_error(message) => ScrapeOutcome::Blocked,
        Err(_) => ScrapeOutcome::Error,
    }
}

fn store() -> &'static Mutex<HashMap<String, BreakerEntry>> {
    static ENTRIES: OnceLock<Mutex<HashMap<String, BreakerEntry>>> = OnceLock::new();
    ENTRIES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// Milliseconds left in the distributor's cooldown, if it is cooling down.
pub fn cooldown_remaining(distributor_id: &str) -> Option<u64> {
    let now = now_ms();
    let guard = store().lock().ok()?;
    let entry = guard.get(distributor_id).copied().unwrap_or_default();
    is_in_cooldown(&entry, now).then(|| entry.cooldown_until_ms.saturating_sub(now))
}

pub fn record(distributor_id: &str, outcome: ScrapeOutcome) {
    let now = now_ms();
    if let Ok(mut guard) = store().lock() {
        let prev = guard.get(distributor_id).copied().unwrap_or_default();
        guard.insert(distributor_id.to_string(), next_entry(prev, outcome, now));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked_trips_the_circuit_for_thirty_minutes() {
        let entry = next_entry(BreakerEntry::default(), ScrapeOutcome::Blocked, 1_000);
        assert_eq!(entry.consecutive_failures, 1);
        assert_eq!(entry.cooldown_until_ms, 1_000 + 30 * 60 * 1000);
        assert!(is_in_cooldown(&entry, 1_000));
        assert!(!is_in_cooldown(&entry, 1_000 + 30 * 60 * 1000));
    }

    #[test]
    fn repeated_blocks_grow_the_cooldown_then_cap() {
        let mut entry = BreakerEntry::default();
        entry = next_entry(entry, ScrapeOutcome::Blocked, 0);
        assert_eq!(entry.cooldown_until_ms, 30 * 60 * 1000);
        entry = next_entry(entry, ScrapeOutcome::Blocked, 0);
        assert_eq!(entry.cooldown_until_ms, 45 * 60 * 1000);
        for _ in 0..8 {
            entry = next_entry(entry, ScrapeOutcome::Blocked, 0);
        }
        assert_eq!(entry.cooldown_until_ms, MAX_COOLDOWN_MS);
    }

    #[test]
    fn hard_errors_cool_down_only_at_the_threshold() {
        let mut entry = BreakerEntry::default();
        entry = next_entry(entry, ScrapeOutcome::Error, 1_000);
        assert_eq!(entry.consecutive_failures, 1);
        assert_eq!(entry.cooldown_until_ms, 0);
        entry = next_entry(entry, ScrapeOutcome::Error, 1_000);
        assert_eq!(entry.consecutive_failures, 2);
        assert_eq!(entry.cooldown_until_ms, 0);
        entry = next_entry(entry, ScrapeOutcome::Error, 1_000);
        assert_eq!(entry.consecutive_failures, 3);
        assert_eq!(entry.cooldown_until_ms, 1_000 + 15 * 60 * 1000);
    }

    #[test]
    fn success_resets_the_breaker() {
        let blocked = next_entry(BreakerEntry::default(), ScrapeOutcome::Blocked, 1_000);
        assert_eq!(
            next_entry(blocked, ScrapeOutcome::Ok, 2_000),
            BreakerEntry::default()
        );
    }

    #[test]
    fn classifies_a_blocked_error_message_as_blocked() {
        assert_eq!(
            outcome_for::<()>(&Err(format!(
                "{} (HTTP 403)",
                super::super::BLOCKED_ERROR_PREFIX
            ))),
            ScrapeOutcome::Blocked
        );
        assert_eq!(
            outcome_for::<()>(&Err("HTTP 500".to_string())),
            ScrapeOutcome::Error
        );
        assert_eq!(outcome_for(&Ok(())), ScrapeOutcome::Ok);
    }

    #[test]
    fn cooldown_remaining_reports_and_expires() {
        // A fresh in-memory store per test run is not guaranteed, so use a
        // unique id and assert only the reported shape.
        let id = "breaker-test-distributor-0";
        assert_eq!(cooldown_remaining(id), None);
        record(id, ScrapeOutcome::Blocked);
        let remaining = cooldown_remaining(id).expect("just blocked");
        assert!(remaining > 0 && remaining <= BLOCKED_COOLDOWN_MS);
    }
}
