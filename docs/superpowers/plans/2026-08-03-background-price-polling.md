# Background Price Polling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the actual price comparison logic in the Rust backend so background polling and "Check Now" detect price drops and fire desktop notifications.

**Architecture:** The Rust backend reads watchlist + alerts JSON files from the app data directory, compares best in-stock prices (converted to alert currency) against target thresholds, fires notifications via tauri-plugin-notification, and deactivates triggered alerts. Exchange rates are hardcoded (matching the mobile app's static rates).

**Tech Stack:** Rust, serde/serde_json, tauri-plugin-notification

**Spec:** `docs/superpowers/specs/2026-08-03-tauri-desktop-design.md`

---

## Context

The mobile app's price check logic is in `lib/background-price-check.ts` (lines 14-65). The Rust backend needs to replicate this logic:

1. Read alerts from `price_alerts.json`
2. Filter for `isActive === true` AND `triggeredAt === undefined`
3. For each alert, find the product in `watchlist_products.json` by `productId`
4. Filter product's listings for `stockStatus === "in_stock"`
5. Convert each listing's price to the alert's currency using exchange rates
6. Find the cheapest converted price
7. If cheapest price <= alert's `targetPrice`:
   - Fire desktop notification with product name, current price, target price
   - Set `alert.isActive = false`
   - Set `alert.triggeredAt = current ISO timestamp`
   - Set `alert.triggeredPrice = cheapest price`
8. Save updated alerts back to `price_alerts.json`

---

## File Structure

### Files to Modify
| File | Change |
|------|--------|
| `desktop/src-tauri/src/lib.rs` | Implement price comparison logic in `check_price_drops` and `start_price_poller` |

---

## Tasks

### Task 1: Add Exchange Rates and Price Comparison Logic

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add exchange rates constant and helper functions**

Add after the existing `use` statements (line 6) in `desktop/src-tauri/src/lib.rs`:

```rust
// ─── Exchange Rates (matching lib/currency.ts) ────────────────────────────────

static EXCHANGE_RATES: [(&str, f64); 12] = [
    ("USD", 1.0),
    ("EUR", 0.92),
    ("GBP", 0.79),
    ("MYR", 4.47),
    ("AUD", 1.53),
    ("NZD", 1.65),
    ("CAD", 1.36),
    ("ZAR", 18.2),
    ("THB", 34.5),
    ("SGD", 1.34),
    ("HKD", 7.82),
    ("AED", 3.67),
];

fn convert_price(amount: f64, from_currency: &str, to_currency: &str) -> f64 {
    let from_rate = EXCHANGE_RATES
        .iter()
        .find(|(c, _)| *c == from_currency)
        .map(|(_, r)| *r)
        .unwrap_or(1.0);
    let to_rate = EXCHANGE_RATES
        .iter()
        .find(|(c, _)| *c == to_currency)
        .map(|(_, r)| *r)
        .unwrap_or(1.0);
    (amount / from_rate) * to_rate
}

fn format_price(amount: f64, currency: &str) -> String {
    let symbol = match currency {
        "USD" => "$",
        "EUR" => "€",
        "GBP" => "£",
        "MYR" => "RM",
        "AUD" => "A$",
        "NZD" => "NZ$",
        "CAD" => "C$",
        "ZAR" => "R",
        "THB" => "฿",
        "SGD" => "S$",
        "HKD" => "HK$",
        "AED" => "AED",
        _ => "",
    };
    format!("{}{:.2}", symbol, amount)
}
```

- [ ] **Step 2: Implement check_price_drops logic**

Replace the `check_price_drops` function (lines 157-165) with:

```rust
#[tauri::command]
fn check_price_drops(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let alerts_val = read_json_file(&data_dir, "price_alerts")?;
    let watchlist_val = read_json_file(&data_dir, "watchlist_products")?;

    let alerts: Vec<serde_json::Value> = alerts_val
        .as_array()
        .cloned()
        .unwrap_or_default();
    let watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut updated_count = 0u32;
    let mut notifications: Vec<(String, String)> = Vec::new();

    for alert in &alerts {
        let is_active = alert.get("isActive").and_then(|v| v.as_bool()).unwrap_or(false);
        let triggered_at = alert.get("triggeredAt").and_then(|v| v.as_str());
        if !is_active || triggered_at.is_some() {
            continue;
        }

        let product_id = alert.get("productId").and_then(|v| v.as_str()).unwrap_or("");
        let target_price = alert.get("targetPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let alert_currency = alert.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");

        let product = watchlist.iter().find(|p| {
            p.get("id").and_then(|v| v.as_str()) == Some(product_id)
        });
        let product = match product {
            Some(p) => p,
            None => continue,
        };

        let listings = product.get("listings").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let in_stock: Vec<&serde_json::Value> = listings.iter().filter(|l| {
            l.get("stockStatus").and_then(|v| v.as_str()) == Some("in_stock")
        }).collect();

        if in_stock.is_empty() {
            continue;
        }

        let best_price = in_stock.iter().fold(f64::INFINITY, |best, listing| {
            let price = listing.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let currency = listing.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");
            let converted = convert_price(price, currency, alert_currency);
            if converted < best { converted } else { best }
        });

        if best_price <= target_price {
            let product_name = product.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Product");
            let body = format!(
                "{} is now {} — below your target of {}!",
                product_name,
                format_price(best_price, alert_currency),
                format_price(target_price, alert_currency)
            );
            notifications.push(("💸 Price Drop Alert!".to_string(), body));
            updated_count += 1;
        }
    }

    // Fire notifications and update alert states
    if !notifications.is_empty() {
        use tauri_plugin_notification::NotificationExt;
        for (title, body) in &notifications {
            let _ = app.notification().builder().title(title).body(body).sound("default".to_string()).show();
        }

        // Update alerts in-place
        let mut updated_alerts = alerts.clone();
        for alert in updated_alerts.iter_mut() {
            let is_active = alert.get("isActive").and_then(|v| v.as_bool()).unwrap_or(false);
            let triggered_at = alert.get("triggeredAt").and_then(|v| v.as_str());
            if !is_active || triggered_at.is_some() {
                continue;
            }

            let product_id = alert.get("productId").and_then(|v| v.as_str()).unwrap_or("");
            let target_price = alert.get("targetPrice").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let alert_currency = alert.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");

            let product = watchlist.iter().find(|p| {
                p.get("id").and_then(|v| v.as_str()) == Some(product_id)
            });
            let product = match product {
                Some(p) => p,
                None => continue,
            };

            let listings = product.get("listings").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let best_price = listings.iter().filter(|l| {
                l.get("stockStatus").and_then(|v| v.as_str()) == Some("in_stock")
            }).fold(f64::INFINITY, |best, listing| {
                let price = listing.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let currency = listing.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");
                let converted = convert_price(price, currency, alert_currency);
                if converted < best { converted } else { best }
            });

            if best_price <= target_price {
                if let Some(obj) = alert.as_object_mut() {
                    obj.insert("isActive".to_string(), serde_json::Value::Bool(false));
                    obj.insert("triggeredAt".to_string(), serde_json::Value::String(current_iso_timestamp()));
                    obj.insert("triggeredPrice".to_string(), serde_json::json!(best_price));
                }
            }
        }

        let updated_val = serde_json::Value::Array(updated_alerts);
        write_json_file(&data_dir, "price_alerts", &updated_val)?;
    }

    Ok(format!("Price check completed. {} alerts triggered.", updated_count))
}
```

- [ ] **Step 3: Implement start_price_poller with actual logic**

Replace the `start_price_poller` function (lines 123-155) with:

```rust
#[tauri::command]
fn start_price_poller(app: tauri::AppHandle, interval_minutes: u64) -> Result<String, String> {
    let mut running = POLLER_RUNNING.lock().map_err(|e| e.to_string())?;
    if *running {
        return Ok("Poller already running".to_string());
    }
    *running = true;
    drop(running);

    let handle = app.clone();
    std::thread::spawn(move || loop {
        {
            let running = POLLER_RUNNING.lock().unwrap();
            if !*running {
                break;
            }
        }

        let _ = check_price_drops(handle.clone());

        std::thread::sleep(std::time::Duration::from_secs(interval_minutes * 60));
    });

    Ok(format!(
        "Price poller started with {} minute interval",
        interval_minutes
    ))
}
```

- [ ] **Step 4: Verify Rust compiles**

Run: `cd desktop/src-tauri && cargo check 2>&1`

Expected: Compiles with 0 errors (warnings are OK)

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat: implement price comparison logic in background polling

Adds exchange rate constants, convert_price/format_price helpers,
and full price drop detection in check_price_drops and
start_price_poller. Fires desktop notifications when prices
fall below alert thresholds."
```

---

## Verification

After the task, run:
```bash
cd desktop/src-tauri && cargo check
pnpm --filter desktop check
```

Both should pass.
