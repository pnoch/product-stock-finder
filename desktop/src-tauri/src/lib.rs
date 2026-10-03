mod scrapers;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

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

/// Live FX overlay, mirroring lib/currency.ts (`setExchangeRates` +
/// `effectiveRates`): the mirrored `fx_rates` file overrides the static table.
/// Without it the poller evaluated alerts against static rates while the UI and
/// mobile used live ones, so the same alert could fire on one platform only.
/// Distinguishes concurrent writers of the same file store key.
static WRITE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

static LIVE_RATES: std::sync::LazyLock<std::sync::RwLock<HashMap<String, f64>>> =
    std::sync::LazyLock::new(|| std::sync::RwLock::new(HashMap::new()));

/// Reload the overlay from the mirrored `fx_rates` file. A missing/corrupt file
/// or an empty rate set clears it, exactly like `setExchangeRates(null)`, and
/// non-finite/non-positive entries are dropped like the shared filter does.
fn refresh_live_rates(data_dir: &Path) {
    let mut parsed: HashMap<String, f64> = HashMap::new();
    if let Ok(value) = read_json_file(data_dir, "fx_rates") {
        if let Some(rates) = value.get("rates").and_then(|v| v.as_object()) {
            for (code, rate) in rates {
                if let Some(rate) = rate.as_f64() {
                    if rate.is_finite() && rate > 0.0 {
                        parsed.insert(code.clone(), rate);
                    }
                }
            }
        }
    }
    if let Ok(mut guard) = LIVE_RATES.write() {
        *guard = parsed;
    }
}

/// The live rate when present, else the static table's — the merge semantics of
/// `effectiveRates()`.
fn rate_for(currency: &str) -> Option<f64> {
    if let Ok(guard) = LIVE_RATES.read() {
        if let Some(rate) = guard.get(currency) {
            return Some(*rate);
        }
    }
    EXCHANGE_RATES
        .iter()
        .find(|(c, _)| *c == currency)
        .map(|(_, r)| *r)
}

fn convert_price(amount: f64, from_currency: &str, to_currency: &str) -> Option<f64> {
    let from_rate = rate_for(from_currency)?;
    let to_rate = rate_for(to_currency)?;
    if !from_rate.is_finite() || !to_rate.is_finite() || from_rate <= 0.0 || to_rate <= 0.0 {
        return None;
    }
    let v = (amount / from_rate) * to_rate;
    if v.is_finite() {
        Some(v)
    } else {
        None
    }
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

fn trigger_event_json(
    alert_id: &str,
    product_id: &str,
    product_name: &str,
    best_price: f64,
    currency: &str,
    target_price: f64,
    is_rise: bool,
) -> serde_json::Value {
    serde_json::json!({ "alertId": alert_id, "productId": product_id, "productName": product_name, "bestPrice": best_price, "currency": currency, "targetPrice": target_price, "isRise": is_rise })
}

fn notification_route_for_product(product_id: &str) -> String {
    format!("/product/{product_id}")
}

fn activation_payload(route: &str) -> serde_json::Value {
    serde_json::json!({ "route": route })
}

// ─── Global State ────────────────────────────────────────────────────────────

static POLLER_RUNNING: Mutex<bool> = Mutex::new(false);
// Bumped on every start/stop. A poller loop captures its generation and exits
// as soon as it changes, so a stop+start cannot leave the old loop running
// alongside the new one (the old loop may be parked in `interval.tick()` for
// up to the full interval before it would otherwise notice).
static POLLER_GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
// Last API base URL the renderer passed (poller start / price check). The tray
// menu has no renderer context, so "Check Now" reads it from here instead of
// passing an empty base (which forced the local scrapers).
static LAST_API_BASE_URL: Mutex<Option<String>> = Mutex::new(None);
// Serializes the full price-check pipeline so a poller tick, manual "Check Now",
// and a direct check_price_drops invoke can't race on the shared JSON files.
static PRICE_CHECK_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: bool,
    route: Option<String>,
) -> Result<(), String> {
    show_notification(&app, &title, &body, sound, route.as_deref())
}

/// Poller interval in seconds. A renderer-supplied minute count can overflow the
/// multiply (debug panic / release wrap to a near-zero interval that never fires
/// again), so saturate and keep a one-minute floor.
fn poller_interval_secs(interval_minutes: u64) -> u64 {
    interval_minutes.saturating_mul(60).max(60)
}

/// The subset of triggered events whose notification was actually delivered.
/// The renderer deactivates every event it receives, so an undelivered one must
/// not be emitted or the alert is consumed without the user being notified.
fn delivered_events(
    events: &[serde_json::Value],
    delivered: &[(String, f64)],
) -> Vec<serde_json::Value> {
    let ids: std::collections::HashSet<&str> =
        delivered.iter().map(|(id, _)| id.as_str()).collect();
    events
        .iter()
        .filter(|e| {
            e.get("alertId")
                .and_then(|v| v.as_str())
                .is_some_and(|id| ids.contains(id))
        })
        .cloned()
        .collect()
}

/// Pairs each triggered alert with its notification result: only alerts whose
/// notification was actually delivered may be deactivated, so a failed toast
/// leaves the alert armed for a later retry.
fn deactivate_after_notify(results: &[bool], triggered: &[(String, f64)]) -> Vec<(String, f64)> {
    triggered
        .iter()
        .enumerate()
        .filter(|(i, _)| results.get(*i).copied().unwrap_or(false))
        .map(|(_, (id, price))| (id.clone(), *price))
        .collect()
}

/// Marks the given alerts inactive/triggered, matched by id so the update can be
/// applied to a freshly read copy of the file rather than the snapshot taken
/// when the check started. A non-array value is returned unchanged.
fn deactivate_alerts_by_id(
    alerts: serde_json::Value,
    triggered: &[(String, f64)],
    snapshot_created: &std::collections::HashMap<String, String>,
) -> serde_json::Value {
    let mut list = match alerts {
        serde_json::Value::Array(items) => items,
        other => return other,
    };
    for (id, best_price) in triggered {
        for alert in list.iter_mut() {
            if alert.get("id").and_then(|v| v.as_str()) == Some(id.as_str()) {
                // Re-arm guard: the decision came from a snapshot taken when the
                // (minutes-long) check began. If the on-disk `createdAt` is newer
                // than the snapshot's, the user re-armed/edited the alert in the
                // meantime — overwriting it would undo their action.
                if let (Some(snapshot), Some(fresh)) = (
                    snapshot_created.get(id),
                    alert.get("createdAt").and_then(|v| v.as_str()),
                ) {
                    if let (Some(s), Some(f)) = (
                        parse_iso_to_epoch_ms(snapshot),
                        parse_iso_to_epoch_ms(fresh),
                    ) {
                        if f > s {
                            continue;
                        }
                    }
                }
                if let Some(obj) = alert.as_object_mut() {
                    obj.insert("isActive".to_string(), serde_json::Value::Bool(false));
                    obj.insert(
                        "triggeredAt".to_string(),
                        serde_json::Value::String(current_iso_timestamp()),
                    );
                    obj.insert("triggeredPrice".to_string(), serde_json::json!(best_price));
                }
            }
        }
    }
    serde_json::Value::Array(list)
}

fn show_notification(
    app: &tauri::AppHandle,
    title: &str,
    body: &str,
    sound: bool,
    route: Option<&str>,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    if let Some(route) = route {
        let app_handle = app.clone();
        // show() returns once the toast is handed to the daemon (a fast D-Bus
        // round trip), unlike wait_for_response which blocks on the user. Its
        // Result must propagate: swallowing it made a failed toast look
        // delivered, so the caller consumed the alert while the user saw
        // nothing.
        let mut n = notify_rust::Notification::new();
        n.summary(title).body(body);
        if sound {
            n.sound_name("default");
        }
        let handle = n.show().map_err(|e| e.to_string())?;
        let route = route.to_owned();
        // Blocking wait for the click is acceptable in the background pool:
        // alerts are rare and Tokio's blocking pool (512 threads) cannot be
        // exhausted by notification bursts. No timeout — a late click still
        // deep-links correctly.
        tauri::async_runtime::spawn_blocking(move || {
            let _ = handle.wait_for_response(|response: &notify_rust::NotificationResponse| {
                if response.is_default_action() {
                    let _ = app_handle.emit("notification-activated", activation_payload(&route));
                    if let Some(w) = app_handle.get_webview_window("main") {
                        let _ = w.set_focus();
                    }
                }
            });
        });
        return Ok(());
    }
    #[cfg(not(target_os = "linux"))]
    // macOS/Windows: notify-rust backends expose no click-callback API, so the
    // route is intentionally dropped here — the toast focuses the app via OS
    // default. Full deep-linking is Linux-only (see spawn path below).
    let _ = route;
    use tauri_plugin_notification::NotificationExt;

    let mut notification = app.notification().builder().title(title).body(body);

    if sound {
        notification = notification.sound("default".to_string());
    }

    notification.show().map_err(|e| e.to_string())
}

// ─── Import/Export ───────────────────────────────────────────────────────────

/// Removes device-local / credential settings from a settings object. Mirrors
/// the shareable-backup rule in lib/settings-privacy.ts: the BYO-LLM API key and
/// the Discord/Slack webhook URL must never travel in a shareable export file
/// (or be adopted from an inbound import).
fn strip_device_local_settings(mut settings: serde_json::Value) -> serde_json::Value {
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("llmApiKey");
        obj.remove("alertWebhookUrl");
    }
    settings
}

fn default_backup_format() -> String {
    "product-stock-finder-backup".to_string()
}

// Wire shape of lib/backup.ts's BackupData. The desktop export must be readable
// by the shared parser (and a mobile backup readable here), so the field names
// are camelCase and `format` is emitted; the snake_case aliases keep files
// written by older desktop builds importable.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportData {
    #[serde(default = "default_backup_format")]
    format: String,
    version: u32,
    #[serde(alias = "exported_at")]
    exported_at: String,
    watchlist: serde_json::Value,
    alerts: serde_json::Value,
    reminders: serde_json::Value,
    settings: serde_json::Value,
    // Mobile's backup includes back-in-stock watches; omitting them silently
    // dropped restock watches from every desktop export/import round-trip.
    #[serde(default, alias = "stock_watches")]
    stock_watches: serde_json::Value,
}

fn validate_import_schema(data: &ExportData) -> Result<(), String> {
    // Reject an unrelated JSON file that merely has the right keys. A missing
    // `format` is allowed: older desktop exports predate the shared schema.
    if data.format != default_backup_format() {
        return Err(format!("Unsupported backup format: {}", data.format));
    }
    // top-level shape
    let watchlist = data
        .watchlist
        .as_array()
        .ok_or("Invalid import structure: watchlist must be an array")?;
    let alerts = data
        .alerts
        .as_array()
        .ok_or("Invalid import structure: alerts must be an array")?;
    let reminders = data
        .reminders
        .as_array()
        .ok_or("Invalid import structure: reminders must be an array")?;
    let settings = data
        .settings
        .as_object()
        .ok_or("Invalid import structure: settings must be an object")?;

    // watchlist items: require id (string), name (string), modelNumber (string) when present
    for (i, item) in watchlist.iter().enumerate() {
        let obj = item
            .as_object()
            .ok_or(format!("watchlist[{}] must be an object", i))?;
        let id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or(format!("watchlist[{}].id must be a non-empty string", i))?;
        if id.trim().is_empty() {
            return Err(format!("watchlist[{}].id must be a non-empty string", i));
        }
        // name and modelNumber are expected for catalog items; validate type if present
        if let Some(v) = obj.get("name") {
            if v.as_str().map(|s| s.trim().is_empty()).unwrap_or(true) {
                return Err(format!("watchlist[{}].name must be a non-empty string", i));
            }
        }
        if let Some(v) = obj.get("modelNumber") {
            if v.as_str().map(|s| s.trim().is_empty()).unwrap_or(true) {
                return Err(format!("watchlist[{}].modelNumber must be a string", i));
            }
        }
        if let Some(listings) = obj.get("listings") {
            let arr = listings
                .as_array()
                .ok_or(format!("watchlist[{}].listings must be an array", i))?;
            for (j, l) in arr.iter().enumerate() {
                let lo = l.as_object().ok_or(format!(
                    "watchlist[{}].listings[{}] must be an object",
                    i, j
                ))?;
                let did = lo
                    .get("distributorId")
                    .and_then(|v| v.as_str())
                    .ok_or(format!(
                        "watchlist[{}].listings[{}].distributorId must be a string",
                        i, j
                    ))?;
                if did.trim().is_empty() {
                    return Err(format!(
                        "watchlist[{}].listings[{}].distributorId must be non-empty",
                        i, j
                    ));
                }
                if let Some(price) = lo.get("price") {
                    let p = price.as_f64().ok_or(format!(
                        "watchlist[{}].listings[{}].price must be a number",
                        i, j
                    ))?;
                    if !p.is_finite() || p < 0.0 {
                        return Err(format!(
                            "watchlist[{}].listings[{}].price must be a finite non-negative number",
                            i, j
                        ));
                    }
                }
            }
        }
    }

    for (i, item) in alerts.iter().enumerate() {
        let obj = item
            .as_object()
            .ok_or(format!("alerts[{}] must be an object", i))?;
        let id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or(format!("alerts[{}].id must be a string", i))?;
        if id.trim().is_empty() {
            return Err(format!("alerts[{}].id must be non-empty", i));
        }
        let pid = obj
            .get("productId")
            .and_then(|v| v.as_str())
            .ok_or(format!("alerts[{}].productId must be a string", i))?;
        if pid.trim().is_empty() {
            return Err(format!("alerts[{}].productId must be non-empty", i));
        }
        let target = obj
            .get("targetPrice")
            .and_then(|v| v.as_f64())
            .ok_or(format!("alerts[{}].targetPrice must be a number", i))?;
        if !target.is_finite() || target <= 0.0 {
            return Err(format!("alerts[{}].targetPrice must be finite >0", i));
        }
        if let Some(cur) = obj.get("currency").and_then(|v| v.as_str()) {
            if cur.trim().is_empty() || cur.len() > 8 {
                return Err(format!("alerts[{}].currency invalid", i));
            }
        }
    }

    for (i, item) in reminders.iter().enumerate() {
        let obj = item
            .as_object()
            .ok_or(format!("reminders[{}] must be an object", i))?;
        let id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or(format!("reminders[{}].id must be a string", i))?;
        if id.trim().is_empty() {
            return Err(format!("reminders[{}].id must be non-empty", i));
        }
        let pid = obj
            .get("productId")
            .and_then(|v| v.as_str())
            .ok_or(format!("reminders[{}].productId must be a string", i))?;
        if pid.trim().is_empty() {
            return Err(format!("reminders[{}].productId must be non-empty", i));
        }
        if let Some(d) = obj.get("reminderDate").and_then(|v| v.as_str()) {
            if d.trim().is_empty() {
                return Err(format!("reminders[{}].reminderDate must be non-empty", i));
            }
            // basic ISO check: must contain a digit and '-' or 'T'
            if !d.chars().any(|c| c.is_ascii_digit()) {
                return Err(format!("reminders[{}].reminderDate invalid", i));
            }
        }
    }

    // settings: if displayCurrency present, validate against known currencies
    if let Some(cur) = settings.get("displayCurrency").and_then(|v| v.as_str()) {
        const ALLOWED: &[&str] = &[
            "USD", "EUR", "GBP", "MYR", "AUD", "NZD", "CAD", "ZAR", "THB", "SGD", "HKD", "AED",
        ];
        if !ALLOWED.contains(&cur) {
            return Err(format!("settings.displayCurrency invalid: {}", cur));
        }
    }

    Ok(())
}

// ─── Storage split-brain note ─────────────────────────────────────────────────
// Desktop frontend persistence is split: the renderer uses `localStorage` via
// `createStorage(localStorageAdapter)` (see `desktop/src/storage.ts`), while
// Tauri commands read/write JSON files in `app_data_dir` (see `read_json_file`/
// `write_json_file` below). To avoid divergence, either adopt
// `tauri-plugin-store` for a single shared store, or keep the frontend in sync
// by reading through the `read_watchlist` invoke exposed below (which reads the
// same JSON file the Rust side owns).
//
// Fix (93c5a24 revert): use string key "watchlist_products" (not object key
// `{ key: "watchlist" }`) and snake_case `set_value_for_key` for Tauri store
// API (was `setValueForKey`). Server DB pool uses `mysql.createPool(url)`
// string form (not `{ uri: url }` object form) — see `server/db.ts`.
#[tauri::command]
async fn read_watchlist(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    read_json_file(&data_dir, "watchlist_products")
}

// Tauri store-compatible filing helper — snake_case required by Tauri API.
// Previously `setValueForKey` (camelCase) which Tauri does not expose; corrected
// to `set_value_for_key`. Uses string key directly (not object wrapper).
#[tauri::command]
async fn set_value_for_key(
    app: tauri::AppHandle,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    // key is a plain string (e.g. "watchlist_products"), not an object like `{ key: "..." }`.
    // Allowlist it: `PathBuf::join` with an absolute key discards data_dir
    // entirely, and `../` escapes it, so an unvalidated key lets any webview
    // script write attacker-controlled .json files anywhere writable.
    if !is_allowed_storage_key(&key) {
        return Err(format!("Refusing to write disallowed key: {key}"));
    }
    // Alerts have their own serialized writer (apply_alert_mutations); the
    // plain setter must take the same lock or it can interleave with the poller.
    if key == "price_alerts" {
        let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        return write_json_file(&data_dir, &key, &value);
    }
    write_json_file(&data_dir, &key, &value)
}

/// Merges a renderer-supplied watchlist into the on-disk one and returns the
/// merged array. The renderer owns the product set and product-level fields
/// (adds/removes/tags/notes), while the Rust poller owns listing price data.
/// A listing whose on-disk `lastChecked` is newer than the incoming one is
/// kept, and disk-only listings survive — otherwise a UI save built from a stale
/// snapshot reverted every price the poller had recorded meanwhile. A product
/// absent from the incoming array is a deliberate removal and stays removed.
fn merge_watchlist_products(
    disk: serde_json::Value,
    incoming: serde_json::Value,
) -> serde_json::Value {
    let incoming = match incoming {
        serde_json::Value::Array(items) => items,
        other => return other,
    };
    let disk_by_id: std::collections::HashMap<String, serde_json::Value> = match disk {
        serde_json::Value::Array(items) => items
            .into_iter()
            .filter_map(|p| {
                // Take the id by value first: `(id.to_string(), p)` moved `p`
                // while `id` still borrowed it.
                let id = p.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
                id.map(|id| (id, p))
            })
            .collect(),
        _ => std::collections::HashMap::new(),
    };
    let merged = incoming
        .into_iter()
        .map(|product| {
            let id = product.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(disk_product) = disk_by_id.get(id) {
                let listings = merge_listings(
                    disk_product.get("listings").and_then(|v| v.as_array()),
                    product.get("listings").and_then(|v| v.as_array()),
                );
                let mut out = product;
                if let Some(obj) = out.as_object_mut() {
                    obj.insert("listings".to_string(), serde_json::Value::Array(listings));
                }
                out
            } else {
                product
            }
        })
        .collect();
    serde_json::Value::Array(merged)
}

fn listing_distributor_id(listing: &serde_json::Value) -> Option<&str> {
    // None (not "") for a missing id: two id-less listings otherwise collided on
    // the same empty key and the "disk-only survives" pass dropped one.
    listing
        .get("distributorId")
        .and_then(|v| v.as_str())
        .filter(|id| !id.is_empty())
}

fn listing_last_checked_ms(listing: &serde_json::Value) -> Option<i64> {
    // Parsed, not string-compared: two spellings of the same instant
    // ("…T00:00:00.000Z" vs "…T00:00:00Z") compare unequal lexicographically.
    listing
        .get("lastChecked")
        .and_then(|v| v.as_str())
        .and_then(parse_iso_to_epoch_ms)
}

fn merge_listings(
    disk: Option<&Vec<serde_json::Value>>,
    incoming: Option<&Vec<serde_json::Value>>,
) -> Vec<serde_json::Value> {
    let empty = Vec::new();
    let disk = disk.unwrap_or(&empty);
    let incoming = incoming.unwrap_or(&empty);
    let mut out: Vec<serde_json::Value> = Vec::with_capacity(disk.len().max(incoming.len()));
    for inc in incoming {
        let id = listing_distributor_id(inc);
        let disk_match =
            id.and_then(|id| disk.iter().find(|d| listing_distributor_id(d) == Some(id)));
        match disk_match {
            // Newer on disk: the poller refreshed it after the UI snapshot.
            Some(d)
                if listing_last_checked_ms(d).unwrap_or(0)
                    > listing_last_checked_ms(inc).unwrap_or(0) =>
            {
                out.push(d.clone())
            }
            _ => out.push(inc.clone()),
        }
    }
    // Listings only the poller knows about (newly discovered) survive. An
    // id-less listing cannot be matched, so it is always kept.
    for d in disk {
        let id = listing_distributor_id(d);
        let present = match id {
            Some(id) => incoming
                .iter()
                .any(|i| listing_distributor_id(i) == Some(id)),
            None => false,
        };
        if !present {
            out.push(d.clone());
        }
    }
    out
}

#[tauri::command]
async fn merge_watchlist(
    app: tauri::AppHandle,
    value: serde_json::Value,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let disk = read_json_file(&data_dir, "watchlist_products")?;
    let merged = merge_watchlist_products(disk, value);
    write_json_file(&data_dir, "watchlist_products", &merged)?;
    serde_json::to_string(&merged).map_err(|e| e.to_string())
}

/// Process-wide lock serializing the alert file's read-modify-write so the
/// renderer's mutation command and the poller's write cannot interleave.
static ALERTS_FILE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(serde::Deserialize)]
struct AlertUpsert {
    id: String,
    patch: serde_json::Value,
}

/// Applies a field patch to one alert. A `null` patch value removes the field;
/// absent fields are left untouched, so poller-owned fields the renderer did not
/// change survive.
fn apply_alert_patch(mut item: serde_json::Value, patch: &serde_json::Value) -> serde_json::Value {
    if let (Some(obj), Some(patch_obj)) = (item.as_object_mut(), patch.as_object()) {
        for (k, v) in patch_obj {
            if k == "id" {
                continue;
            }
            if v.is_null() {
                obj.remove(k);
            } else {
                obj.insert(k.clone(), v.clone());
            }
        }
    }
    item
}

fn apply_alert_mutations_to(
    disk: serde_json::Value,
    upserts: &[AlertUpsert],
    removes: &[String],
) -> serde_json::Value {
    let mut list = match disk {
        serde_json::Value::Array(items) => items,
        _ => Vec::new(),
    };
    if removes.iter().any(|r| !r.is_empty()) {
        list.retain(|a| {
            let id = a.get("id").and_then(|v| v.as_str()).unwrap_or("");
            !removes.iter().any(|r| !r.is_empty() && r.as_str() == id)
        });
    }
    for up in upserts {
        match list
            .iter()
            .position(|a| a.get("id").and_then(|v| v.as_str()) == Some(up.id.as_str()))
        {
            Some(idx) => list[idx] = apply_alert_patch(list[idx].clone(), &up.patch),
            None => list.push(apply_alert_patch(
                serde_json::json!({ "id": up.id }),
                &up.patch,
            )),
        }
    }
    serde_json::Value::Array(list)
}

#[tauri::command]
async fn apply_alert_mutations(
    app: tauri::AppHandle,
    upserts: Vec<AlertUpsert>,
    removes: Vec<String>,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let disk = read_json_file(&data_dir, "price_alerts")?;
    let merged = apply_alert_mutations_to(disk, &upserts, &removes);
    write_json_file(&data_dir, "price_alerts", &merged)?;
    serde_json::to_string(&merged).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_value_for_key(
    app: tauri::AppHandle,
    key: String,
) -> Result<serde_json::Value, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !is_allowed_storage_key(&key) {
        return Err(format!("Refusing to read disallowed key: {key}"));
    }
    read_json_file(&data_dir, &key)
}

/// Only the keys the renderer legitimately mirrors to disk.
fn is_allowed_storage_key(key: &str) -> bool {
    matches!(
        key,
        "watchlist_products"
            | "price_alerts"
            | "back_order_reminders"
            | "app_settings"
            | "back_in_stock_watches"
            // Live FX rates: mirrored so the poller converts with the same
            // overlay the UI/mobile use (lib/currency.ts effectiveRates).
            | "fx_rates"
    )
}

#[tauri::command]
async fn export_watchlist(app: tauri::AppHandle, format: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // A never-written collection reads as Null (the file is missing) and the
    // importer requires the array/object shape, so the app could not restore its
    // own export on a fresh profile.
    let watchlist = array_or_empty(read_json_file(&data_dir, "watchlist_products")?);
    let alerts = array_or_empty(read_json_file(&data_dir, "price_alerts")?);
    let reminders = array_or_empty(read_json_file(&data_dir, "back_order_reminders")?);
    // The BYO-LLM API key is device-local and must never leave the device (see
    // lib/settings-privacy.ts); without stripping it the shareable export file
    // contained the user's provider key in plaintext.
    let settings =
        strip_device_local_settings(object_or_empty(read_json_file(&data_dir, "app_settings")?));
    let stock_watches = array_or_empty(read_json_file(&data_dir, "back_in_stock_watches")?);

    let export = ExportData {
        format: default_backup_format(),
        version: 1,
        exported_at: current_iso_timestamp(),
        watchlist,
        alerts,
        reminders,
        settings,
        stock_watches,
    };

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?,
        "csv" => export_to_csv(&export)?,
        _ => return Err(format!("Unsupported format: {}", format)),
    };

    Ok(content)
}

#[tauri::command]
async fn import_watchlist(
    app: tauri::AppHandle,
    content: String,
    format: String,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    match format.as_str() {
        "json" => {
            if content.len() > 10 * 1024 * 1024 {
                return Err("Import file too large (max 10MB)".to_string());
            }
            let import: ExportData =
                serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

            if import.version != 1 {
                return Err(format!("Unsupported version: {}", import.version));
            }

            validate_import_schema(&import)?;

            // An inbound file must not replace this device's own key either
            // (mirrors applyLocalLlmKey): drop it before it reaches disk.
            let import_settings = strip_device_local_settings(import.settings.clone());

            let mut entries: Vec<(&str, &serde_json::Value)> = vec![
                ("watchlist_products", &import.watchlist),
                ("price_alerts", &import.alerts),
                ("back_order_reminders", &import.reminders),
                ("app_settings", &import_settings),
            ];
            if !import.stock_watches.is_null() {
                entries.push(("back_in_stock_watches", &import.stock_watches));
            }
            // Serialize with the poller/command: the import writes price_alerts
            // too, and an interleaved poller write would be lost.
            let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            write_json_files_atomically(&data_dir, &entries)?;

            Ok("Import successful".to_string())
        }
        "csv" => Err("CSV import not yet implemented".to_string()),
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

// ─── OAuth (localhost loopback) ───────────────────────────────────────────────

fn parse_query_params(query: &str) -> std::collections::HashMap<String, String> {
    let mut params = std::collections::HashMap::new();
    let path = query.split_whitespace().nth(1).unwrap_or("");
    if let Some(q) = path.split('?').nth(1) {
        for pair in q.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let decoded = urlencoding::decode(v).unwrap_or_else(|_| v.into());
                params.insert(k.to_string(), decoded.to_string());
            }
        }
    }
    params
}

fn open_system_browser(url: &str) -> Result<(), String> {
    // Validate here rather than only in `open_external`: `start_oauth` passes a
    // renderer-supplied URL to this same helper.
    if !is_allowed_external_url(url) {
        return Err(format!("Refusing to open disallowed URL: {url}"));
    }
    #[cfg(target_os = "linux")]
    {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(url);
        spawn_and_reap(command).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let mut command = std::process::Command::new("open");
        command.arg(url);
        spawn_and_reap(command).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        // Quoted: `cmd` re-parses its command line, so an unquoted `&` in the
        // URL would start a second command.
        let quoted = format!("\"{}\"", url.replace('"', "%22"));
        let mut command = std::process::Command::new("cmd");
        command.args(["/C", "start", "", quoted.as_str()]);
        spawn_and_reap(command).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Spawns an opener process and reaps it on a detached thread. Dropping the
/// `Child` directly leaves a zombie until the app exits, and repeated opens
/// accumulate them.
fn spawn_and_reap(mut command: std::process::Command) -> std::io::Result<()> {
    let mut child = command.spawn()?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

/// External URLs the app may hand to the system browser (http(s) and mailto).
/// Restricting the scheme keeps a compromised renderer from launching arbitrary
/// handlers.
fn is_allowed_external_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")
}

/// Opens an external URL in the user's browser. The webview cannot do this
/// itself — `start_oauth` already shells out for the same reason — so links
/// that used `window.open`/`target="_blank"` were dead in the packaged app.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !is_allowed_external_url(&url) {
        return Err(format!("Refusing to open disallowed URL: {url}"));
    }
    open_system_browser(&url)
}

#[tauri::command]
async fn start_oauth(login_url: String) -> Result<serde_json::Value, String> {
    open_system_browser(&login_url)?;

    let listener = TcpListener::bind("127.0.0.1:3420")
        .await
        .map_err(|e| format!("Failed to bind OAuth callback listener: {e}"))?;

    // Loop until the real callback arrives. A stray local connection (favicon
    // prefetch, port scan, another process) must not consume the single accept
    // and abort the login.
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(120);
    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err("OAuth callback timed out after 120 seconds".to_string());
        }
        let (mut socket, _) = tokio::time::timeout(remaining, listener.accept())
            .await
            .map_err(|_| "OAuth callback timed out after 120 seconds".to_string())?
            .map_err(|e| format!("Failed to accept OAuth callback: {e}"))?;

        let mut buf = [0u8; 8192];
        // Bound the read: an unbounded read lets a stray local process that
        // connects and sends nothing wedge the login loop forever (the accept
        // deadline is only checked at the top of the loop).
        let n = match tokio::time::timeout(std::time::Duration::from_secs(5), socket.read(&mut buf))
            .await
        {
            Ok(Ok(n)) => n,
            _ => continue,
        };
        let request = String::from_utf8_lossy(&buf[..n]).to_string();
        let request_line = request.lines().next().unwrap_or_default().to_string();
        let params = parse_query_params(&request_line);

        // Only the callback path carries the ticket; ignore anything else.
        let path = request_line.split_whitespace().nth(1).unwrap_or("");
        let ticket = params.get("ticket").cloned().unwrap_or_default();
        if !path.starts_with("/callback") || ticket.is_empty() {
            let _ = socket
                .write_all(
                    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await;
            continue;
        }

        let body = "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:80px\"><h3>Login successful. You can close this window.</h3></body></html>";
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        socket
            .write_all(response.as_bytes())
            .await
            .map_err(|e| format!("Failed to respond to OAuth callback: {e}"))?;

        // Only accept the single-use, server-issued ticket — never a raw
        // session token from the URL (attacker-controllable: login CSRF /
        // session fixation). Mirrors lib/oauth-callback.ts.
        return Ok(serde_json::json!({ "ticket": ticket }));
    }
}

// ─── Background Polling ──────────────────────────────────────────────────────

#[tauri::command]
async fn start_price_poller(
    app: tauri::AppHandle,
    interval_minutes: u64,
    api_base_url: String,
) -> Result<String, String> {
    // A zero interval would panic `tokio::time::interval`.
    if interval_minutes == 0 {
        return Err("interval_minutes must be greater than 0".to_string());
    }
    if !api_base_url.is_empty() {
        if let Ok(mut stored) = LAST_API_BASE_URL.lock() {
            *stored = Some(api_base_url.clone());
        }
    }
    let mut running = POLLER_RUNNING.lock().map_err(|e| e.to_string())?;
    if *running {
        return Ok("Poller already running".to_string());
    }
    *running = true;
    drop(running);
    let generation = POLLER_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        // Backfill is handled by the renderer (lib/history-sync.ts), which has
        // the session token; the Rust path is a no-op without one.
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
            poller_interval_secs(interval_minutes),
        ));
        interval.tick().await;
        loop {
            // Exit if stopped, or if a newer poller generation has started.
            if POLLER_GENERATION.load(std::sync::atomic::Ordering::SeqCst) != generation {
                break;
            }
            {
                let running = POLLER_RUNNING.lock().unwrap();
                if !*running {
                    break;
                }
            }

            let _ = run_full_price_check(handle.clone(), api_base_url.clone()).await;

            interval.tick().await;
        }
    });

    Ok(format!(
        "Price poller started with {} minute interval",
        interval_minutes
    ))
}

#[tauri::command]
async fn check_price_drops(app: tauri::AppHandle) -> Result<String, String> {
    // Async lock: blocking_lock() here would stall the executor while
    // run_full_price_check holds the same mutex across awaited scrapes.
    let _guard = PRICE_CHECK_LOCK.lock().await;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    check_price_drops_inner(&app, &data_dir)
}

fn check_price_drops_inner(app: &tauri::AppHandle, data_dir: &PathBuf) -> Result<String, String> {
    // Convert with the same live overlay the UI uses before comparing prices.
    refresh_live_rates(data_dir);
    let alerts_val = read_json_file(data_dir, "price_alerts")?;
    let watchlist_val = read_json_file(data_dir, "watchlist_products")?;
    let settings_val = read_json_file(data_dir, "app_settings")?;

    // Mirror the mobile gate: price alerts must be enabled and we must be
    // outside quiet hours, or the poller/tray would notify against the user's
    // settings.
    let notifications_enabled = settings_val
        .get("notificationsEnabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let price_alerts_enabled = settings_val
        .get("priceAlerts")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    if !notifications_enabled || !price_alerts_enabled {
        return Ok("Price alerts disabled".to_string());
    }
    // NOTE: quiet hours deliberately do NOT gate price alerts. Mobile applies
    // quiet hours to health alerts and digests only (lib/background-tasks/
    // price-check.ts), and skipping here would permanently miss a drop that
    // occurred and recovered during the window.

    let alerts: Vec<serde_json::Value> = alerts_val.as_array().cloned().unwrap_or_default();
    let watchlist: Vec<serde_json::Value> = watchlist_val.as_array().cloned().unwrap_or_default();

    // Compute which alerts have dropped below target in a single pass.
    // Returns (alert_index, best_price) for each triggered alert.
    // (alert id, best price): ids, not indices, so the flags can be applied to
    // a freshly read copy of the file (the check runs for minutes).
    let mut triggered: Vec<(String, f64)> = Vec::new();
    // Snapshot `createdAt` per triggered alert id, so the post-notify write can
    // skip an alert the user re-armed while the check was running.
    let mut snapshot_created: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut notifications: Vec<(String, String, Option<String>)> = Vec::new();
    let mut events: Vec<serde_json::Value> = Vec::new();

    for alert in alerts.iter() {
        let is_active = alert
            .get("isActive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let triggered_at = alert.get("triggeredAt").and_then(|v| v.as_str());
        if !is_active || triggered_at.is_some() {
            continue;
        }
        // Parse rather than compare strings: JS writes millis
        // ("...12:00:00.000Z") while current_iso_timestamp() omits them, so a
        // lexicographic compare misfires at equal instants.
        if snooze_blocks(
            alert.get("snoozedUntil").and_then(|v| v.as_str()),
            now_epoch_ms(),
        ) {
            continue;
        }

        let product_id = alert
            .get("productId")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let target_price = alert
            .get("targetPrice")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let alert_currency = alert
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("USD");
        // "rise" alerts fire when the price goes ABOVE the target.
        let is_rise = alert.get("direction").and_then(|v| v.as_str()) == Some("rise");
        // Per-distributor alerts only consider that distributor's listing.
        let scoped_distributor = alert.get("distributorId").and_then(|v| v.as_str());

        let product = watchlist
            .iter()
            .find(|p| p.get("id").and_then(|v| v.as_str()) == Some(product_id));
        let product = match product {
            Some(p) => p,
            None => continue,
        };

        let listings = product
            .get("listings")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let best_price = listings
            .iter()
            .filter(|l| {
                // Only in-stock listings can anchor a price alert (matches mobile).
                if l.get("stockStatus").and_then(|v| v.as_str()) != Some("in_stock") {
                    return false;
                }
                if let Some(dist) = scoped_distributor {
                    if l.get("distributorId").and_then(|v| v.as_str()) != Some(dist) {
                        return false;
                    }
                }
                true
            })
            .fold(f64::INFINITY, |best, listing| {
                let price = listing.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
                if price <= 0.0 {
                    return best;
                }
                let currency = listing
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("USD");
                let converted = match convert_price(price, currency, alert_currency) {
                    Some(v) => v,
                    None => return best,
                };
                if converted < best {
                    converted
                } else {
                    best
                }
            });

        let hit = best_price.is_finite()
            && if is_rise {
                best_price >= target_price
            } else {
                best_price <= target_price
            };
        if hit {
            let product_name = product
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown Product");
            let body = format!(
                "{} is now {} — {} your target of {}!",
                product_name,
                format_price(best_price, alert_currency),
                if is_rise { "above" } else { "below" },
                format_price(target_price, alert_currency)
            );
            notifications.push((
                if is_rise {
                    "Price Increase Alert!".to_string()
                } else {
                    "Price Drop Alert!".to_string()
                },
                body,
                Some(notification_route_for_product(product_id)),
            ));
            let alert_id = alert.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(created) = alert.get("createdAt").and_then(|v| v.as_str()) {
                snapshot_created.insert(alert_id.to_string(), created.to_string());
            }
            events.push(trigger_event_json(
                alert_id,
                product_id,
                product_name,
                best_price,
                alert_currency,
                target_price,
                is_rise,
            ));
            // Pushed for every hit, even with an empty id, so `triggered` stays
            // index-aligned with `notifications`: otherwise results[i] was read
            // for the wrong alert and a failed toast could consume a different
            // alert than the one that succeeded.
            triggered.push((alert_id.to_string(), best_price));
        }
    }

    if !notifications.is_empty() {
        let mut results = Vec::with_capacity(notifications.len());
        for (title, body, route) in &notifications {
            match show_notification(app, title, body, true, route.as_deref()) {
                Ok(()) => results.push(true),
                Err(e) => {
                    // Leave the alert armed: consuming it here would drop the
                    // notification permanently even though the user saw nothing.
                    eprintln!("[alerts] notification failed; alert left armed: {e}");
                    results.push(false);
                }
            }
        }
        let to_deactivate = deactivate_after_notify(&results, &triggered);
        if !to_deactivate.is_empty() {
            let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            // Re-read immediately before writing: the file may have changed
            // while this (minutes-long) check ran, and writing the snapshot read
            // at the start silently reverted a concurrent add/snooze/delete.
            let fresh = array_or_empty(read_json_file(data_dir, "price_alerts")?);
            let updated_val = deactivate_alerts_by_id(fresh, &to_deactivate, &snapshot_created);
            // Emit only the delivered alerts: the renderer deactivates every
            // event it receives, so emitting an undelivered one consumed an
            // alert the user was never notified about (undoing the file-store
            // fix above).
            let delivered_events = delivered_events(&events, &to_deactivate);
            let _ = app.emit("price-drops-triggered", &delivered_events);
            write_json_file(data_dir, "price_alerts", &updated_val)?;
        }
    }

    Ok(format!(
        "Price check completed. {} alerts triggered.",
        triggered.len()
    ))
}

#[tauri::command]
fn stop_price_poller() -> Result<String, String> {
    let mut running = POLLER_RUNNING.lock().map_err(|e| e.to_string())?;
    *running = false;
    // Invalidate the running loop so it exits at its next wake-up instead of
    // continuing if start_price_poller flips the flag back to true first.
    POLLER_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    Ok("Price poller stopped".to_string())
}

// ─── Scrapers ───────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct WatchedProduct {
    id: String,
    model_number: String,
    distributor_ids: Vec<String>,
}

#[tauri::command]
async fn check_all_prices(
    products: Vec<WatchedProduct>,
    api_base_url: String,
) -> Result<Vec<scrapers::ScrapeJobResult>, String> {
    use futures::StreamExt as _;
    use std::sync::Arc;

    let semaphore = Arc::new(tokio::sync::Semaphore::new(3));
    let mut futures = futures::stream::FuturesUnordered::new();

    for product in products {
        for distributor_id in product.distributor_ids {
            let sem = semaphore.clone();
            let api_url = api_base_url.clone();
            let product_id = product.id.clone();
            let model = product.model_number.clone();
            let dist = distributor_id.clone();
            futures.push(async move {
                let _permit = sem.acquire_owned().await.map_err(|e| e.to_string())?;
                let start = std::time::Instant::now();
                let (scrape_result, history) =
                    match fetch_server_price(&api_url, &dist, &model).await {
                        Some((r, h)) => (Ok(r), h),
                        None => (scrape_distributor(&dist, &model).await, Vec::new()),
                    };
                let duration_ms = start.elapsed().as_millis() as u64;
                let (result, error) = match scrape_result {
                    Ok(r) => (Some(r), None),
                    Err(e) => (None, Some(e)),
                };
                Ok::<scrapers::ScrapeJobResult, String>(scrapers::ScrapeJobResult {
                    distributor_id: dist,
                    product_id,
                    result,
                    error,
                    duration_ms,
                    history,
                })
            });
        }
    }

    let mut results = Vec::new();
    while let Some(res) = futures.next().await {
        results.push(res?);
    }
    Ok(results)
}

#[tauri::command]
async fn fetch_price_insight(
    api_base_url: String,
    product_id: String,
    llm_headers: Option<std::collections::HashMap<String, String>>,
) -> Result<Option<serde_json::Value>, String> {
    if api_base_url.is_empty() {
        return Ok(None);
    }
    let input = serde_json::json!({
        "json": { "productId": product_id }
    });
    let url = format!(
        "{}/api/trpc/insights.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let mut req = client.get(&url).timeout(std::time::Duration::from_secs(8));
    // The app's BYO-LLM config (x-llm-* headers from the renderer). Without them
    // the server could not route this insight through the user's own provider,
    // so a configured provider was silently ignored here (the browser path goes
    // through the tRPC client, which sends them).
    if let Some(headers) = llm_headers {
        for (key, value) in headers {
            if let (Ok(name), Ok(val)) = (
                reqwest::header::HeaderName::from_bytes(key.as_bytes()),
                reqwest::header::HeaderValue::from_str(&value),
            ) {
                req = req.header(name, val);
            }
        }
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let data = body.pointer("/result/data/json");
    match data {
        Some(v) if !v.is_null() => Ok(Some(v.clone())),
        _ => Ok(None),
    }
}

#[tauri::command]
async fn fetch_product_image(
    api_base_url: String,
    product_id: String,
) -> Result<Option<serde_json::Value>, String> {
    if api_base_url.is_empty() {
        return Ok(None);
    }
    let input = serde_json::json!({
        "json": { "productId": product_id }
    });
    let url = format!(
        "{}/api/trpc/images.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let data = body.pointer("/result/data/json");
    match data {
        Some(v) if !v.is_null() => Ok(Some(v.clone())),
        _ => Ok(None),
    }
}

async fn scrape_distributor(
    distributor_id: &str,
    model: &str,
) -> Result<scrapers::ScrapeResult, String> {
    // Circuit breaker, mirroring the shared resilient fetch: a distributor that
    // is blocking or repeatedly failing is skipped until its cooldown expires
    // instead of being hammered (which compounds a block).
    if let Some(remaining_ms) = scrapers::breaker::cooldown_remaining(distributor_id) {
        let minutes = remaining_ms.div_ceil(60_000);
        return Err(format!(
            "{distributor_id} is in cooldown for another {minutes} minute(s) after repeated failures"
        ));
    }
    let result = match distributor_id {
        "server2u" | "server2u-my" => scrapers::server2u::scrape(model, false).await,
        "linitx-uk" => scrapers::linitx::scrape(model, false).await,
        "interprojekt-pl" => scrapers::interprojekt::scrape(model, false).await,
        "nasstore-eu" => scrapers::nasstore::scrape(model, true).await,
        "aerial-gr" => scrapers::aerial::scrape(model, true).await,
        "mikrotikstore-de" => scrapers::mikrotikstore::scrape(model, false).await,
        "miro-za" => scrapers::miro::scrape(model, true).await,
        "gearup-ae" => scrapers::gearup::scrape(model, false).await,
        "balticnetworks-us" => scrapers::balticnetworks::scrape(model, false).await,
        "linktechs-us" => scrapers::linktechs::scrape(model, true).await,
        "winncom-us" => scrapers::winncom::scrape(model, true).await,
        "bhphoto-us" => scrapers::bhphoto::scrape(model, true).await,
        "duxtel-au" => scrapers::duxtel::scrape(model, false).await,
        "wisp-au" => scrapers::wisp::scrape(model, true).await,
        "pbtech-nz" => scrapers::pbtech::scrape(model, true).await,
        "gowifi-nz" => scrapers::gowifi::scrape(model, true).await,
        "getic-gr" => scrapers::getic::scrape(model, true).await,
        "100mega-cz" => scrapers::mega::scrape(model, true).await,
        "hellascom-gr" => scrapers::hellascom::scrape(model, true).await,
        "rocnoc-us" => scrapers::rocnoc::scrape(model, true).await,
        "networkdevices-us" => scrapers::networkdevices::scrape(model, true).await,
        "flytec-us" => scrapers::flytec::scrape(model, false).await,
        "mbsiwav-ca" => scrapers::mbsiwav::scrape(model, true).await,
        "multilink-us" => scrapers::multilink::scrape(model, true).await,
        "neobits-us" => scrapers::neobits::scrape(model, true).await,
        _ => Err(format!("No scraper for distributor: {}", distributor_id)),
    };
    scrapers::breaker::record(distributor_id, scrapers::breaker::outcome_for(&result));
    result
}

// Matches PRICE_SNAPSHOT_TTL_MS in shared/const.ts (1 hour).
const SERVER_SNAPSHOT_TTL_MS: i64 = 60 * 60 * 1000;

/// Mirrors `isFreshPriceSnapshot`: fresh while the age is strictly under the
/// TTL (a snapshot exactly at the TTL is stale) and never for a non-finite
/// stamp. Compared in f64 so the arithmetic matches the JS client, and a
/// fractional `fetchedAt` is accepted the way `Number.isFinite` accepts it —
/// the previous `as_i64()` dropped a non-integer stamp entirely.
fn is_fresh_snapshot(fetched_at: f64, now_ms: i64) -> bool {
    fetched_at.is_finite() && (now_ms as f64) - fetched_at < SERVER_SNAPSHOT_TTL_MS as f64
}

async fn fetch_server_price(
    api_base_url: &str,
    distributor_id: &str,
    model: &str,
) -> Option<(scrapers::ScrapeResult, Vec<serde_json::Value>)> {
    if api_base_url.is_empty() {
        return None;
    }
    let input = serde_json::json!({
        "json": {
            "distributorId": distributor_id,
            "modelNumber": model,
        }
    });
    let url = format!(
        "{}/api/trpc/prices.get?input={}",
        api_base_url.trim_end_matches('/'),
        urlencoding::encode(&input.to_string())
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    let data = body.pointer("/result/data/json")?;
    let snapshot = data.get("snapshot")?;
    // Reject a stale cached snapshot: the server returns its cached value and
    // only kicks off a background refresh, so accepting it would persist an
    // up-to-an-hour-old price as if just observed (and append a fake history
    // point). Mirrors mobile's isFreshPriceSnapshot.
    let fetched_at = snapshot.get("fetchedAt").and_then(|v| v.as_f64())?;
    if !is_fresh_snapshot(fetched_at, now_epoch_ms()) {
        return None;
    }
    let price = snapshot.get("price")?.as_f64()?;
    let currency = snapshot.get("currency")?.as_str()?.to_string();
    let stock_status = snapshot
        .get("stockStatus")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let expected_date = snapshot
        .get("expectedDate")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let url = snapshot
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let history = data
        .get("history")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Some((
        scrapers::ScrapeResult {
            price,
            currency,
            stock_status,
            expected_date,
            url,
        },
        history,
    ))
}

// ─── Distributor Health ──────────────────────────────────────────────────────

/// One marker list for the whole desktop: the scrapers' copy (itself guarded
/// against lib/scrapers/resilient.ts). This file used to keep a third, already
/// drifted list (a bare `challenge-platform` instead of the full path).
fn is_blocked_error(msg: &str) -> bool {
    scrapers::is_blocked_error(msg)
        || scrapers::BLOCKED_MARKERS
            .iter()
            .any(|marker| msg.contains(marker))
}

fn classify_fetch_status(msg: &str) -> &str {
    if is_blocked_error(msg) {
        "blocked"
    } else {
        "error"
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DistributorHealth {
    distributor_id: String,
    status: String,
    reason: Option<String>,
    response_time_ms: Option<u64>,
    last_checked: String,
}

// Per-distributor probe model. Must mirror PROBE_MODEL_BY_DISTRIBUTOR in
// lib/scrapers/health.ts: probing every distributor with CRS326 made the model
// gate reject the price for the 12 that stock CRS804, reporting them as errors.
fn probe_model_for(distributor_id: &str) -> &'static str {
    match distributor_id {
        "server2u-my" | "interprojekt-pl" | "aerial-gr" | "miro-za" | "linktechs-us"
        | "bhphoto-us" | "wisp-au" | "gowifi-nz" | "100mega-cz" | "rocnoc-us" | "flytec-us"
        | "multilink-us" => "CRS804-4DDQ-hRM",
        _ => "CRS326-24S+2Q+RM",
    }
}

#[tauri::command]
async fn check_distributor_health(app: tauri::AppHandle) -> Result<Vec<DistributorHealth>, String> {
    let distributor_ids = [
        "server2u-my",
        "linitx-uk",
        "interprojekt-pl",
        "nasstore-eu",
        "aerial-gr",
        "mikrotikstore-de",
        "miro-za",
        "gearup-ae",
        "balticnetworks-us",
        "linktechs-us",
        "winncom-us",
        "bhphoto-us",
        "duxtel-au",
        "wisp-au",
        "pbtech-nz",
        "gowifi-nz",
        "getic-gr",
        "100mega-cz",
        "hellascom-gr",
        "rocnoc-us",
        "networkdevices-us",
        "flytec-us",
        "mbsiwav-ca",
        "multilink-us",
        "neobits-us",
    ];

    let total = distributor_ids.len() as u32;
    let mut results = Vec::new();
    for (idx, distributor_id) in distributor_ids.iter().enumerate() {
        let start = std::time::Instant::now();
        let model = probe_model_for(distributor_id);
        let scrape_result = scrape_distributor(distributor_id, model).await;
        let duration_ms = start.elapsed().as_millis() as u64;

        let (status, reason) = match scrape_result {
            Ok(r) if r.price > 0.0 => ("working".to_string(), None),
            Ok(_) => ("error".to_string(), Some("no price found".to_string())),
            Err(e) if is_blocked_error(&e) => ("blocked".to_string(), Some(e)),
            Err(e) => (classify_fetch_status(&e).to_string(), Some(e)),
        };

        results.push(DistributorHealth {
            distributor_id: distributor_id.to_string(),
            status,
            reason,
            response_time_ms: Some(duration_ms),
            last_checked: current_iso_timestamp(),
        });
        let progress = ((idx as u32 + 1) * 100) / total;
        let _ = app.emit(
            "health-check-progress",
            serde_json::json!({ "progress": progress, "distributorId": distributor_id }),
        );
    }

    Ok(results)
}

// ─── Full Price Check (scrape → compare → notify → update tray) ─────────────

#[tauri::command]
async fn run_full_price_check(
    app: tauri::AppHandle,
    api_base_url: String,
) -> Result<String, String> {
    let _guard = PRICE_CHECK_LOCK.lock().await;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let watchlist_val = read_json_file(&data_dir, "watchlist_products")?;
    let watchlist: Vec<serde_json::Value> = watchlist_val.as_array().cloned().unwrap_or_default();

    if watchlist.is_empty() {
        return Ok("No products in watchlist".to_string());
    }

    let products: Vec<WatchedProduct> = watchlist
        .iter()
        .filter_map(|p| {
            let id = p.get("id")?.as_str()?.to_string();
            let model_number = p.get("modelNumber")?.as_str()?.to_string();
            let distributor_ids: Vec<String> = p
                .get("listings")
                .and_then(|v| v.as_array())?
                .iter()
                .filter_map(|l| l.get("distributorId")?.as_str().map(|s| s.to_string()))
                .collect();
            if distributor_ids.is_empty() {
                None
            } else {
                Some(WatchedProduct {
                    id,
                    model_number,
                    distributor_ids,
                })
            }
        })
        .collect();

    if products.is_empty() {
        return Ok("No products with scrapable distributors".to_string());
    }

    let results = check_all_prices(products, api_base_url).await?;

    for job_result in &results {
        if let Some(scrape) = &job_result.result {
            update_listing_price(
                &data_dir,
                &job_result.product_id,
                &job_result.distributor_id,
                scrape,
                &job_result.history,
            )?;
            let _ = app.emit(
                "listing-updated",
                serde_json::json!({
                    "productId": job_result.product_id,
                    "distributorId": job_result.distributor_id,
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                    "expectedDate": scrape.expected_date,
                    "lastChecked": current_iso_timestamp(),
                }),
            );
        }
    }

    let triggered = check_price_drops_inner(&app, &data_dir)?;
    let _ = update_tray_badge(app.clone());
    let _ = app.emit("prices-checked", &results);

    Ok(format!(
        "Full check: {} scrapes, {}",
        results.len(),
        triggered
    ))
}

fn update_listing_price(
    data_dir: &PathBuf,
    product_id: &str,
    distributor_id: &str,
    scrape: &scrapers::ScrapeResult,
    server_history: &[serde_json::Value],
) -> Result<(), String> {
    let watchlist_val = read_json_file(data_dir, "watchlist_products")?;
    let mut watchlist: Vec<serde_json::Value> =
        watchlist_val.as_array().cloned().unwrap_or_default();

    let mut updated = false;
    for product in watchlist.iter_mut() {
        if product.get("id").and_then(|v| v.as_str()) != Some(product_id) {
            continue;
        }
        let listings = match product.get_mut("listings").and_then(|v| v.as_array_mut()) {
            Some(l) => l,
            None => continue,
        };
        for listing in listings.iter_mut() {
            if listing.get("distributorId").and_then(|v| v.as_str()) != Some(distributor_id) {
                continue;
            }
            if let Some(obj) = listing.as_object_mut() {
                obj.insert("price".to_string(), serde_json::json!(scrape.price));
                obj.insert("currency".to_string(), serde_json::json!(scrape.currency));
                obj.insert(
                    "stockStatus".to_string(),
                    serde_json::json!(scrape.stock_status),
                );
                if let Some(expected) = &scrape.expected_date {
                    obj.insert("expectedDate".to_string(), serde_json::json!(expected));
                } else {
                    obj.remove("expectedDate");
                }
                obj.insert(
                    "lastChecked".to_string(),
                    serde_json::json!(current_iso_timestamp()),
                );
                // Persist the URL actually scraped (mobile's refreshListing does
                // the same); without it the listing link stays at the stale
                // seeded/sample URL.
                if !scrape.url.is_empty() {
                    obj.insert("url".to_string(), serde_json::json!(scrape.url));
                }

                // Merge server history (union by day, newest wins) then append today's point,
                // pruning to a 90-day window.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                // Matches PRICE_HISTORY_DAYS in shared/const.ts (365): a shorter
                // window silently discarded ~9 months of history on desktop.
                let cutoff_day = iso_date_from_secs(now.saturating_sub(365 * 86400));
                let point = serde_json::json!({
                    "date": current_iso_timestamp(),
                    "price": scrape.price,
                    "currency": scrape.currency,
                    "stockStatus": scrape.stock_status,
                });
                let existing = obj.get_mut("priceHistory").and_then(|v| v.as_array_mut());
                match existing {
                    Some(arr) => {
                        for hp in server_history {
                            append_price_point_with_retention(arr, hp.clone(), &cutoff_day);
                        }
                        append_price_point_with_retention(arr, point, &cutoff_day);
                    }
                    None => {
                        let mut arr = server_history.to_vec();
                        arr.push(point);
                        obj.insert("priceHistory".to_string(), serde_json::Value::Array(arr));
                    }
                }
                updated = true;
            }
        }
    }

    if updated {
        let val = serde_json::Value::Array(watchlist);
        write_json_file(data_dir, "watchlist_products", &val)?;
    }
    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn read_json_file(data_dir: &Path, key: &str) -> Result<serde_json::Value, String> {
    let path = data_dir.join(format!("{}.json", key));
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str(&content) {
        Ok(value) => Ok(value),
        Err(e) => {
            // Quarantine a corrupt file instead of returning Err forever: the
            // poller ignores read errors, so one bad file silently disabled all
            // price polling and tray updates with no recovery path.
            let quarantine = data_dir.join(format!("{}.json.corrupt", key));
            let _ = fs::rename(&path, &quarantine);
            eprintln!(
                "[storage] quarantined corrupt {key}.json -> {} ({e})",
                quarantine.display()
            );
            Ok(serde_json::Value::Null)
        }
    }
}

fn write_json_contents(path: &std::path::Path, value: &serde_json::Value) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

// Atomic write: a crash mid-`fs::write` (truncate + write) would leave a
// truncated file that `read_json_file` then fails to parse, aborting the
// poller/alert/tray paths. Write to a temp file and rename over the target.
// Unique per writer: a fixed `{key}.json.tmp` let the renderer mirror and the
// poller collide, installing each other's content or failing the rename
// (whose error the mirror swallows).
fn write_json_path(path: &std::path::Path, value: &serde_json::Value) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("data.json");
    let dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let tmp = dir.join(format!(
        "{}.{}.{}.tmp",
        file_name,
        std::process::id(),
        WRITE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    write_json_contents(&tmp, value)?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn write_json_file(data_dir: &PathBuf, key: &str, value: &serde_json::Value) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    write_json_path(&data_dir.join(format!("{}.json", key)), value)
}

/// Applies a multi-file import. Every value is staged to a sibling temp file
/// first, and the temps are only renamed into place once *all* writes succeed:
/// writing the finals one by one meant a failure part-way (disk full,
/// permissions) replaced some collections and not others, while the UI still
/// showed pre-import state.
fn write_json_files_atomically(
    data_dir: &PathBuf,
    entries: &[(&str, &serde_json::Value)],
) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let pid = std::process::id();
    let mut staged: Vec<(std::path::PathBuf, std::path::PathBuf)> = Vec::new();
    for (key, value) in entries {
        let final_path = data_dir.join(format!("{}.json", key));
        let temp_path = data_dir.join(format!(
            "{}.json.{}.{}.import.tmp",
            key,
            pid,
            WRITE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        if let Err(e) = write_json_contents(&temp_path, value) {
            for (temp, _) in &staged {
                let _ = fs::remove_file(temp);
            }
            let _ = fs::remove_file(&temp_path);
            return Err(e);
        }
        staged.push((temp_path, final_path));
    }
    for (temp, final_path) in staged {
        if let Err(e) = fs::rename(&temp, &final_path) {
            let _ = fs::remove_file(&temp);
            return Err(e.to_string());
        }
    }
    Ok(())
}

fn array_or_empty(value: serde_json::Value) -> serde_json::Value {
    if value.is_null() {
        serde_json::json!([])
    } else {
        value
    }
}

fn object_or_empty(value: serde_json::Value) -> serde_json::Value {
    if value.is_null() {
        serde_json::json!({})
    } else {
        value
    }
}

/// Matches the mobile price-check predicate: a present-but-unparseable
/// `snoozedUntil` still counts as snoozed (mobile `NaN <= now` is false, so the
/// alert is filtered), while an absent/empty string does not.
fn snooze_blocks(snoozed_until: Option<&str>, now_ms: i64) -> bool {
    match snoozed_until {
        None => false,
        Some(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return false;
            }
            match parse_iso_to_epoch_ms(trimmed) {
                Some(until) => until > now_ms,
                None => true,
            }
        }
    }
}

fn export_to_csv(_export: &ExportData) -> Result<String, String> {
    Err("CSV export not yet implemented".to_string())
}

fn now_epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Parses an ISO-8601 UTC timestamp ("YYYY-MM-DDTHH:MM:SS[.mmm]Z") to epoch ms.
/// Returns None for anything unparseable so callers can fall back safely.
fn parse_iso_to_epoch_ms(value: &str) -> Option<i64> {
    let bytes = value.as_bytes();
    if bytes.len() < 20 || bytes[4] != b'-' || bytes[7] != b'-' || bytes[10] != b'T' {
        return None;
    }
    let year: i64 = value.get(0..4)?.parse().ok()?;
    let month: i64 = value.get(5..7)?.parse().ok()?;
    let day: i64 = value.get(8..10)?.parse().ok()?;
    let hour: i64 = value.get(11..13)?.parse().ok()?;
    let minute: i64 = value.get(14..16)?.parse().ok()?;
    let second: i64 = value.get(17..19)?.parse().ok()?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    // Days since epoch via a civil-date conversion (Howard Hinnant's algorithm).
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;
    Some(((days * 86400) + hour * 3600 + minute * 60 + second) * 1000)
}

fn current_iso_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let days = secs / 86400;
    let mut year = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }
    let mut month = 1u32;
    let mut remaining = remaining_days as u32;
    let month_lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (i, &ml) in month_lengths.iter().enumerate() {
        let dim = if i == 1 && ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
            29
        } else {
            ml
        };
        if remaining < dim {
            break;
        }
        remaining -= dim;
        month += 1;
    }
    let day = remaining + 1;
    let secs_of_day = secs % 86400;
    let hour = secs_of_day / 3600;
    let minute = (secs_of_day % 3600) / 60;
    let second = secs_of_day % 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

// ─── Price History Retention ────────────────────────────────────────────────

fn iso_date_prefix(ts: &str) -> &str {
    ts.get(..10).unwrap_or(ts)
}

fn iso_date_from_secs(secs: u64) -> String {
    let days = secs / 86400;
    let mut year = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }
    let mut month = 1u32;
    let mut remaining = remaining_days as u32;
    let month_lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (i, &ml) in month_lengths.iter().enumerate() {
        let dim = if i == 1 && ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
            29
        } else {
            ml
        };
        if remaining < dim {
            break;
        }
        remaining -= dim;
        month += 1;
    }
    let day = remaining + 1;
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn append_price_point_with_retention(
    history: &mut Vec<serde_json::Value>,
    point: serde_json::Value,
    cutoff_day: &str,
) {
    let today = point
        .get("date")
        .and_then(|d| d.as_str())
        .map(iso_date_prefix)
        .unwrap_or_default()
        .to_string();

    let same_day = history.iter_mut().find(|p| {
        p.get("date").and_then(|d| d.as_str()).map(iso_date_prefix) == Some(today.as_str())
    });

    match same_day {
        // Keep the newer observation, mirroring the mobile `appendPricePoint`
        // (`point.date > existing.date`): overwriting unconditionally replaced a
        // newer local point with an older server history point.
        Some(existing) => {
            let incoming = point.get("date").and_then(|d| d.as_str()).unwrap_or("");
            let current = existing.get("date").and_then(|d| d.as_str()).unwrap_or("");
            let newer = match (
                parse_iso_to_epoch_ms(incoming),
                parse_iso_to_epoch_ms(current),
            ) {
                (Some(a), Some(b)) => a > b,
                _ => incoming > current,
            };
            if newer {
                *existing = point;
            }
        }
        None => history.push(point),
    }

    history.retain(|p| {
        p.get("date")
            .and_then(|d| d.as_str())
            .map(|d| iso_date_prefix(d) >= cutoff_day)
            .unwrap_or(true)
    });
}

// ─── Tray Badge ──────────────────────────────────────────────────────────────

#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let alerts_val = read_json_file(&data_dir, "price_alerts")?;
    let reminders_val = read_json_file(&data_dir, "back_order_reminders")?;

    // Count every untriggered alert (armed + snoozed + paused): the Alerts page
    // renders each as a card, so the tray badge matches the in-app badge count.
    let open_alerts = alerts_val
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|a| a.get("triggeredAt").and_then(|v| v.as_str()).is_none())
                .count()
        })
        .unwrap_or(0);

    let active_reminders = reminders_val
        .as_array()
        .map(|r| {
            r.iter()
                .filter(|r| r.get("reminderType").and_then(|v| v.as_str()) != Some("back_in_stock"))
                .count()
        })
        .unwrap_or(0);

    // Back-in-stock watches live in their own file and count toward the badge
    // too (mobile counts alerts + reminders + watches).
    let watches_val = read_json_file(&data_dir, "back_in_stock_watches")?;
    let active_watches = watches_val.as_array().map(|w| w.len()).unwrap_or(0);

    let total = open_alerts + active_reminders + active_watches;

    if let Some(tray) = app.tray_by_id("main") {
        let badge_text = if total > 0 {
            total.to_string()
        } else {
            String::new()
        };
        let _ = tray.set_title(Some(&badge_text));
        let tooltip = format!(
            "Product Stock Finder — {} alert{}",
            total,
            if total == 1 { "" } else { "s" }
        );
        let _ = tray.set_tooltip(Some(&tooltip));
    }

    Ok(format!("Tray badge updated: {} total", total))
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let open_item = MenuItemBuilder::new("Open").id("open").build(app)?;
            let check_item = MenuItemBuilder::new("Check Now")
                .id("check_now")
                .build(app)?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open_item)
                .item(&separator1)
                .item(&check_item)
                .item(&separator2)
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::with_id("main")
                // Fixed id: update_tray_badge looks the tray up by "main".
                // TrayIconBuilder::new() assigns a unique per-process id, so
                // without this the badge/tooltip updates silently no-op.
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "check_now" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            // Use the last known API base so the server-first
                            // price path is used; an empty base forced the
                            // local scrapers.
                            let base = LAST_API_BASE_URL
                                .lock()
                                .ok()
                                .and_then(|b| b.clone())
                                .unwrap_or_default();
                            let _ = run_full_price_check(app_handle, base).await;
                        });
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Update badge on startup
            let _ = update_tray_badge(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_notification,
            open_external,
            read_watchlist,
            set_value_for_key,
            merge_watchlist,
            apply_alert_mutations,
            export_watchlist,
            import_watchlist,
            start_price_poller,
            check_price_drops,
            stop_price_poller,
            update_tray_badge,
            read_value_for_key,
            check_all_prices,
            run_full_price_check,
            fetch_price_insight,
            fetch_product_image,
            check_distributor_health,
            start_oauth
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                tauri::async_runtime::block_on(async move {
                    crate::scrapers::browser::browser_pool_shutdown().await;
                });
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(ts: &str, price: f64) -> serde_json::Value {
        serde_json::json!({
            "date": ts,
            "price": price,
            "currency": "USD",
            "stockStatus": "in_stock",
        })
    }

    #[test]
    fn live_fx_rates_override_the_static_table() {
        // Mirrors lib/currency.ts effectiveRates(): the overlay wins, an absent
        // currency falls back to the static table, and invalid entries are
        // dropped. The poller used only the static table.
        {
            let mut guard = LIVE_RATES.write().unwrap();
            *guard = HashMap::from([("EUR".to_string(), 1.0)]);
        }
        assert_eq!(convert_price(100.0, "USD", "EUR"), Some(100.0));
        assert_eq!(convert_price(100.0, "USD", "GBP"), Some(79.0));
        {
            let mut guard = LIVE_RATES.write().unwrap();
            *guard = HashMap::new();
        }
        assert_eq!(convert_price(100.0, "USD", "EUR"), Some(92.0));
        assert_eq!(convert_price(100.0, "USD", "ZZZ"), None);
    }

    #[test]
    fn is_fresh_snapshot_matches_the_shared_boundary() {
        // Mirrors tests/price-freshness.test.ts, including "false exactly at the
        // TTL boundary" — the old `>` comparison accepted that snapshot.
        let now = 1_700_000_000_000_i64;
        let ttl = SERVER_SNAPSHOT_TTL_MS as f64;
        assert!(is_fresh_snapshot(now as f64 - 1_000.0, now));
        assert!(!is_fresh_snapshot(now as f64 - ttl, now));
        assert!(!is_fresh_snapshot(now as f64 - ttl - 1.0, now));
        assert!(!is_fresh_snapshot(now as f64 - 2.0 * ttl, now));
        assert!(is_fresh_snapshot(now as f64 + 1_000.0, now));
        assert!(!is_fresh_snapshot(f64::NAN, now));
        assert!(!is_fresh_snapshot(f64::INFINITY, now));
        assert!(!is_fresh_snapshot(f64::NEG_INFINITY, now));
        assert!(is_fresh_snapshot(now as f64 - 1_000.5, now));
    }

    #[test]
    fn health_classifies_a_blocked_scrape_as_blocked() {
        // Regression: the fetch error used to drop the HTTP reason phrase, so
        // the health probe reported a blocked distributor as "error".
        let message = format!("{} (HTTP 403 Forbidden)", scrapers::BLOCKED_ERROR_PREFIX);
        assert!(is_blocked_error(&message));
        assert_eq!(classify_fetch_status(&message), "blocked");
        // A plain network failure stays an error.
        assert_eq!(classify_fetch_status("error sending request"), "error");
    }

    #[test]
    fn iso_date_from_secs_returns_iso_date() {
        // 2026-08-11T00:00:00Z = 1786406400 epoch seconds
        assert_eq!(iso_date_from_secs(1786406400), "2026-08-11");
    }

    #[test]
    fn replaces_point_on_same_utc_day() {
        let mut history = vec![point("2026-08-11T08:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T20:00:00.000Z", 108.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 1);
        assert_eq!(history[0]["price"], 108.0);
        assert_eq!(history[0]["date"], "2026-08-11T20:00:00.000Z");
    }

    #[test]
    fn keeps_the_newer_point_on_same_utc_day() {
        // Mirror of the mobile appendPricePoint: an older incoming server point
        // must not replace a newer local one.
        let mut history = vec![point("2026-08-11T20:00:00.000Z", 108.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 100.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 1);
        assert_eq!(history[0]["price"], 108.0);
        assert_eq!(history[0]["date"], "2026-08-11T20:00:00.000Z");
    }

    #[test]
    fn rejects_disallowed_schemes_before_spawning() {
        // start_oauth passes a renderer-supplied URL to open_system_browser too.
        assert!(open_system_browser("file:///etc/passwd").is_err());
        assert!(open_system_browser("javascript:alert(1)").is_err());
    }

    #[test]
    fn concurrent_writers_all_succeed_on_one_key() {
        // A fixed temp filename made two writers collide (rename ENOENT); the
        // mirror swallowed that error and the write was lost.
        let dir = std::env::temp_dir().join(format!("psf-write-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let handles: Vec<_> = (0..8)
            .map(|i| {
                let dir = dir.clone();
                std::thread::spawn(move || {
                    write_json_file(&dir, "watchlist_products", &serde_json::json!([{ "i": i }]))
                })
            })
            .collect();
        for handle in handles {
            assert!(handle.join().unwrap().is_ok());
        }
        let content = std::fs::read_to_string(dir.join("watchlist_products.json")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert!(parsed.is_array());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_normalizes_never_written_collections() {
        assert_eq!(
            array_or_empty(serde_json::Value::Null),
            serde_json::json!([])
        );
        assert_eq!(
            object_or_empty(serde_json::Value::Null),
            serde_json::json!({})
        );
        let arr = serde_json::json!([1]);
        assert_eq!(array_or_empty(arr.clone()), arr);
    }

    #[test]
    fn merge_watchlist_keeps_poller_price_updates() {
        let disk = serde_json::json!([
            { "id": "p1", "name": "P1", "listings": [
                { "distributorId": "d1", "price": 480, "lastChecked": "2026-06-02T00:00:00.000Z" },
                { "distributorId": "d2", "price": 99, "lastChecked": "2026-06-01T00:00:00.000Z" }
            ]}
        ]);
        // The UI snapshot predates the poller's d1 update and lacks d2 entirely.
        let incoming = serde_json::json!([
            { "id": "p1", "name": "P1", "tags": ["a"], "listings": [
                { "distributorId": "d1", "price": 500, "lastChecked": "2026-06-01T00:00:00.000Z" }
            ]}
        ]);
        let merged = merge_watchlist_products(disk, incoming);
        let product = &merged.as_array().unwrap()[0];
        // Product-level field comes from the UI...
        assert_eq!(product["tags"], serde_json::json!(["a"]));
        let listings = product["listings"].as_array().unwrap();
        // ...the poller's newer price wins...
        assert_eq!(listings[0]["price"], serde_json::json!(480));
        // ...and a listing only the poller knows about survives.
        assert_eq!(listings[1]["distributorId"], serde_json::json!("d2"));
    }

    #[test]
    fn merge_watchlist_does_not_resurrect_a_removed_product() {
        let disk = serde_json::json!([{ "id": "p1" }, { "id": "gone" }]);
        let incoming = serde_json::json!([{ "id": "p1", "listings": [] }]);
        let merged = merge_watchlist_products(disk, incoming);
        let ids: Vec<serde_json::Value> = merged
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["id"].clone())
            .collect();
        assert_eq!(ids, vec![serde_json::json!("p1")]);
    }

    #[test]
    fn merge_listings_compares_parsed_instants_not_strings() {
        // Same instant, different spelling: a lexicographic compare said the
        // disk copy was "newer" and kept the stale price.
        let disk = serde_json::json!([{ "id": "p1", "listings": [
            { "distributorId": "d1", "price": 480, "lastChecked": "2026-06-02T00:00:00Z" }
        ]}]);
        let incoming = serde_json::json!([{ "id": "p1", "listings": [
            { "distributorId": "d1", "price": 500, "lastChecked": "2026-06-02T00:00:00.000Z" }
        ]}]);
        let merged = merge_watchlist_products(disk, incoming);
        // Equal instants: the incoming (UI) copy wins, not the disk one.
        assert_eq!(merged[0]["listings"][0]["price"], serde_json::json!(500));
    }

    #[test]
    fn merge_listings_keeps_id_less_listings() {
        // Two id-less listings used to collide on "" and one was dropped.
        // Explicit empty strings (not missing fields): those are the ones that
        // used to collide on the "" key.
        let disk = serde_json::json!([{ "id": "p1", "listings": [
            { "distributorId": "", "price": 1, "lastChecked": "2026-06-01T00:00:00Z" }
        ]}]);
        let incoming = serde_json::json!([{ "id": "p1", "listings": [
            { "distributorId": "", "price": 2, "lastChecked": "2026-06-02T00:00:00Z" }
        ]}]);
        let merged = merge_watchlist_products(disk, incoming);
        assert_eq!(merged[0]["listings"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn merge_watchlist_keeps_an_incoming_listing_the_disk_lacks() {
        let disk = serde_json::json!([{ "id": "p1", "listings": [] }]);
        let incoming = serde_json::json!([{ "id": "p1", "listings": [
            { "distributorId": "d9", "price": 10, "lastChecked": "2026-06-01T00:00:00.000Z" }
        ]}]);
        let merged = merge_watchlist_products(disk, incoming);
        assert_eq!(
            merged[0]["listings"][0]["distributorId"],
            serde_json::json!("d9")
        );
    }

    #[test]
    fn import_stages_all_files_before_renaming_any() {
        let dir = std::env::temp_dir().join(format!("psf-import-atomic-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        write_json_file(
            &dir,
            "watchlist_products",
            &serde_json::json!([{ "old": true }]),
        )
        .unwrap();

        let err = write_json_files_atomically(
            &dir,
            &[
                ("watchlist_products", &serde_json::json!([{ "new": true }])),
                // A nested key cannot be staged (its parent dir does not exist),
                // so the import must abort before renaming any file.
                ("nested/bad", &serde_json::json!([])),
            ],
        );

        assert!(err.is_err());
        let content = std::fs::read_to_string(dir.join("watchlist_products.json")).unwrap();
        assert!(content.contains("old"));
        assert!(!content.contains("new"));
        let leftovers = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".import.tmp"))
            .count();
        assert_eq!(leftovers, 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn import_writes_every_file_on_success() {
        let dir = std::env::temp_dir().join(format!("psf-import-ok-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let watchlist = serde_json::json!([{ "id": "p1" }]);
        let alerts = serde_json::json!([{ "id": "a1" }]);
        write_json_files_atomically(
            &dir,
            &[
                ("watchlist_products", &watchlist),
                ("price_alerts", &alerts),
            ],
        )
        .unwrap();
        assert!(std::fs::read_to_string(dir.join("watchlist_products.json"))
            .unwrap()
            .contains("p1"));
        assert!(std::fs::read_to_string(dir.join("price_alerts.json"))
            .unwrap()
            .contains("a1"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_data_round_trips_the_shared_backup_schema() {
        let value = serde_json::json!({
            "format": "product-stock-finder-backup",
            "version": 1,
            "exportedAt": "2026-01-01T00:00:00.000Z",
            "watchlist": [],
            "alerts": [],
            "reminders": [],
            "stockWatches": [],
            "settings": { "displayCurrency": "EUR" }
        });
        let parsed: ExportData = serde_json::from_value(value).unwrap();
        assert_eq!(parsed.exported_at, "2026-01-01T00:00:00.000Z");
        assert!(parsed.stock_watches.is_array());
        // Serializes back with the shared (camelCase) names so lib/backup.ts can
        // read a desktop export.
        let out = serde_json::to_value(&parsed).unwrap();
        assert_eq!(out["exportedAt"], "2026-01-01T00:00:00.000Z");
        assert!(out.get("stockWatches").is_some());
        assert_eq!(out["format"], "product-stock-finder-backup");
    }

    #[test]
    fn export_data_accepts_legacy_snake_case_files() {
        let legacy = serde_json::json!({
            "version": 1,
            "exported_at": "2026-01-01T00:00:00.000Z",
            "watchlist": [],
            "alerts": [],
            "reminders": [],
            "stock_watches": [],
            "settings": {}
        });
        let parsed: ExportData = serde_json::from_value(legacy).unwrap();
        assert_eq!(parsed.exported_at, "2026-01-01T00:00:00.000Z");
        // A missing format defaults to the shared one.
        assert_eq!(parsed.format, "product-stock-finder-backup");
    }

    #[test]
    fn poller_interval_saturates_instead_of_overflowing() {
        assert_eq!(poller_interval_secs(0), 60);
        assert_eq!(poller_interval_secs(15), 900);
        assert_eq!(poller_interval_secs(u64::MAX), u64::MAX);
    }

    #[test]
    fn strip_device_local_settings_removes_the_llm_key() {
        let settings = serde_json::json!({
            "llmApiKey": "sk-secret",
            "alertWebhookUrl": "https://discord.com/api/webhooks/1/secret",
            "displayCurrency": "EUR"
        });
        let stripped = strip_device_local_settings(settings);
        assert!(stripped.get("llmApiKey").is_none());
        assert!(stripped.get("alertWebhookUrl").is_none());
        assert_eq!(stripped.get("displayCurrency").unwrap(), "EUR");
        // Non-object input is passed through unchanged.
        assert_eq!(
            strip_device_local_settings(serde_json::Value::Null),
            serde_json::Value::Null
        );
    }

    #[test]
    fn classify_fetch_status_marks_a_blocked_message_as_blocked() {
        // The health path uses this wrapper (not scrapers::is_blocked_error
        // directly), so a regression here would misreport a blocked distributor
        // as a transient error — the health dashboard and the breaker both key
        // off it.
        assert_eq!(classify_fetch_status("403 Forbidden"), "blocked");
        assert_eq!(classify_fetch_status("Just a moment"), "blocked");
        assert_eq!(classify_fetch_status("captcha-delivery.com"), "blocked");
        assert_eq!(classify_fetch_status("connection reset"), "error");
        assert!(!is_blocked_error("timeout"));
    }

    #[test]
    fn delivered_events_excludes_undelivered_alerts() {
        let events = vec![
            serde_json::json!({ "alertId": "a", "bestPrice": 1.0 }),
            serde_json::json!({ "alertId": "b", "bestPrice": 2.0 }),
        ];
        // Only "b" was delivered: emitting "a" would let the renderer consume an
        // alert the user was never notified about.
        let kept = delivered_events(&events, &[("b".to_string(), 2.0)]);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0]["alertId"], serde_json::json!("b"));
        assert!(delivered_events(&events, &[]).is_empty());
    }

    #[test]
    fn deactivate_after_notify_skips_failed_notifications() {
        let triggered = vec![("a".to_string(), 10.0f64), ("b".to_string(), 20.0f64)];
        // First delivered, second failed: only the delivered alert is consumed.
        assert_eq!(
            deactivate_after_notify(&[true, false], &triggered),
            vec![("a".to_string(), 10.0f64)]
        );
        // All delivered.
        assert_eq!(
            deactivate_after_notify(&[true, true], &triggered),
            triggered
        );
        // A missing result is treated as not delivered.
        assert!(deactivate_after_notify(&[], &triggered).is_empty());
    }

    #[test]
    fn deactivate_alerts_by_id_flags_only_the_named_alerts() {
        let alerts = serde_json::json!([
            { "id": "a", "isActive": true },
            { "id": "other", "isActive": true }
        ]);
        let updated = deactivate_alerts_by_id(
            alerts,
            &[("a".to_string(), 12.5)],
            &std::collections::HashMap::new(),
        );
        let list = updated.as_array().unwrap();
        assert_eq!(list[0]["isActive"], serde_json::json!(false));
        assert_eq!(list[0]["triggeredPrice"], serde_json::json!(12.5));
        assert!(list[0]["triggeredAt"].is_string());
        // An unrelated alert is untouched.
        assert_eq!(list[1]["isActive"], serde_json::json!(true));
        // A non-array is returned unchanged.
        assert_eq!(
            deactivate_alerts_by_id(
                serde_json::Value::Null,
                &[],
                &std::collections::HashMap::new()
            ),
            serde_json::Value::Null
        );
    }

    #[test]
    fn deactivate_alerts_by_id_skips_a_rearmed_alert() {
        let alerts = serde_json::json!([
            { "id": "a", "isActive": true, "createdAt": "2026-06-02T00:00:00.000Z" }
        ]);
        let mut snapshot = std::collections::HashMap::new();
        snapshot.insert("a".to_string(), "2026-06-01T00:00:00.000Z".to_string());
        let updated = deactivate_alerts_by_id(alerts, &[("a".to_string(), 12.5)], &snapshot);
        let a = &updated.as_array().unwrap()[0];
        // The on-disk createdAt is newer than the snapshot: the user re-armed it
        // during the check, so it must not be deactivated.
        assert_eq!(a["isActive"], serde_json::json!(true));
        assert!(a.get("triggeredAt").is_none());
    }

    #[test]
    fn snooze_blocks_matches_the_mobile_predicate() {
        let now = 1_700_000_000_000_i64; // 2023-11-14
        assert!(!snooze_blocks(None, now));
        assert!(!snooze_blocks(Some(""), now));
        assert!(!snooze_blocks(Some("   "), now));
        assert!(snooze_blocks(Some("2026-01-01T00:00:00.000Z"), now));
        assert!(!snooze_blocks(Some("2020-01-01T00:00:00.000Z"), now));
        // Present but unparseable: the mobile filters the alert out.
        assert!(snooze_blocks(Some("not-a-date"), now));
    }

    #[test]
    fn appends_new_day_point() {
        let mut history = vec![point("2026-08-10T09:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 2);
        assert_eq!(history[1]["date"], "2026-08-11T09:00:00.000Z");
    }

    #[test]
    fn prunes_points_older_than_cutoff() {
        let mut history = vec![
            point("2026-05-10T09:00:00.000Z", 90.0),
            point("2026-06-01T09:00:00.000Z", 95.0),
        ];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        let dates: Vec<&str> = history
            .iter()
            .map(|p| &p["date"].as_str().unwrap()[..10])
            .collect();
        assert_eq!(dates, vec!["2026-06-01", "2026-08-11"]);
    }

    #[test]
    fn keeps_point_exactly_at_cutoff() {
        let mut history = vec![point("2026-05-13T09:00:00.000Z", 100.0)];
        append_price_point_with_retention(
            &mut history,
            point("2026-08-11T09:00:00.000Z", 105.0),
            "2026-05-13",
        );
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn trigger_event_json_shape() {
        let v = trigger_event_json("a1", "p1", "Widget", 88.5, "USD", 100.0, false);
        assert_eq!(v["alertId"], "a1");
        assert_eq!(v["productId"], "p1");
        assert_eq!(v["bestPrice"], 88.5);
        assert_eq!(v["currency"], "USD");
        assert_eq!(v["targetPrice"], 100.0);
    }

    #[test]
    fn only_http_and_mailto_urls_may_be_opened() {
        assert!(is_allowed_external_url("https://example.com/p"));
        assert!(is_allowed_external_url("http://example.com"));
        assert!(is_allowed_external_url("mailto:support@example.com"));
        assert!(is_allowed_external_url("  HTTPS://EXAMPLE.COM  "));
        assert!(!is_allowed_external_url("file:///etc/passwd"));
        assert!(!is_allowed_external_url("javascript:alert(1)"));
        assert!(!is_allowed_external_url(""));
    }

    #[test]
    fn notification_route_for_product() {
        assert_eq!(
            super::notification_route_for_product("crs804"),
            "/product/crs804"
        );
    }

    #[test]
    fn notification_activated_payload_shape() {
        let v = super::activation_payload("/health");
        assert_eq!(v["route"], "/health");
    }

    #[test]
    fn storage_key_allowlist_rejects_traversal_and_absolute_paths() {
        assert!(is_allowed_storage_key("watchlist_products"));
        assert!(is_allowed_storage_key("app_settings"));
        assert!(!is_allowed_storage_key("../../etc/passwd"));
        assert!(!is_allowed_storage_key("/home/user/.bashrc"));
        assert!(!is_allowed_storage_key("evil"));
    }

    #[test]
    fn probe_model_matches_mobile_map() {
        // The 12 distributors that stock CRS804.
        for id in [
            "server2u-my",
            "interprojekt-pl",
            "aerial-gr",
            "miro-za",
            "linktechs-us",
            "bhphoto-us",
            "wisp-au",
            "gowifi-nz",
            "100mega-cz",
            "rocnoc-us",
            "flytec-us",
            "multilink-us",
        ] {
            assert_eq!(probe_model_for(id), "CRS804-4DDQ-hRM", "{id}");
        }
        assert_eq!(probe_model_for("linitx-uk"), "CRS326-24S+2Q+RM");
    }

    #[test]
    fn parse_iso_to_epoch_ms_handles_millis_and_plain() {
        // 2026-08-11T00:00:00Z = 1786406400000 ms
        assert_eq!(
            parse_iso_to_epoch_ms("2026-08-11T00:00:00Z"),
            Some(1786406400000)
        );
        // Millis form (what JS writes) parses to the same instant.
        assert_eq!(
            parse_iso_to_epoch_ms("2026-08-11T00:00:00.000Z"),
            Some(1786406400000)
        );
        assert_eq!(parse_iso_to_epoch_ms("not-a-date"), None);
        assert_eq!(parse_iso_to_epoch_ms(""), None);
    }

    #[test]
    fn snooze_comparison_is_not_lexicographic() {
        // JS writes millis; the Rust timestamp omits them. At the same instant
        // the millis string sorts BEFORE the plain one, so a string compare
        // would treat a still-snoozed alert as not snoozed.
        let js = "2026-08-11T00:00:00.000Z";
        let rust = "2026-08-11T00:00:00Z";
        assert!(js < rust, "precondition: lexicographic order differs");
        assert_eq!(
            parse_iso_to_epoch_ms(js),
            parse_iso_to_epoch_ms(rust),
            "parsed instants must be equal"
        );
    }

    #[test]
    fn apply_alert_mutations_preserves_a_poller_trigger() {
        let disk = serde_json::json!([
            { "id": "a1", "isActive": false, "targetPrice": 500,
              "triggeredAt": "2026-06-02T00:00:00.000Z", "triggeredPrice": 480 }
        ]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({ "targetPrice": 450 }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(a["targetPrice"], serde_json::json!(450));
        assert_eq!(
            a["triggeredAt"],
            serde_json::json!("2026-06-02T00:00:00.000Z")
        );
        assert_eq!(a["triggeredPrice"], serde_json::json!(480));
        assert_eq!(a["isActive"], serde_json::json!(false));
    }

    #[test]
    fn apply_alert_mutations_rearm_clears_the_trigger() {
        let disk = serde_json::json!([
            { "id": "a1", "isActive": false,
              "triggeredAt": "2026-06-02T00:00:00.000Z", "triggeredPrice": 480 }
        ]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({
                "isActive": true,
                "triggeredAt": serde_json::Value::Null,
                "triggeredPrice": serde_json::Value::Null,
            }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(a["isActive"], serde_json::json!(true));
        assert!(a.get("triggeredAt").is_none());
        assert!(a.get("triggeredPrice").is_none());
    }

    #[test]
    fn apply_alert_mutations_adds_and_removes() {
        let disk = serde_json::json!([{ "id": "a1" }, { "id": "a2" }]);
        let upserts = vec![AlertUpsert {
            id: "a3".into(),
            patch: serde_json::json!({ "targetPrice": 10 }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &["a1".to_string()]);
        let ids: Vec<&str> = merged
            .as_array()
            .unwrap()
            .iter()
            .map(|a| a["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["a2", "a3"]);
    }

    #[test]
    fn apply_alert_mutations_ignores_a_missing_id() {
        let disk = serde_json::json!([{ "id": "a1" }]);
        let merged = apply_alert_mutations_to(disk, &[], &["nope".to_string()]);
        assert_eq!(merged.as_array().unwrap().len(), 1);
    }

    #[test]
    fn apply_alert_patch_ignores_id() {
        let disk = serde_json::json!([{ "id": "a1", "targetPrice": 1 }]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({ "id": "evil", "targetPrice": 2 }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(a["id"], serde_json::json!("a1"));
        assert_eq!(a["targetPrice"], serde_json::json!(2));
    }

    #[test]
    fn apply_alert_mutations_ignores_empty_remove_id() {
        let disk = serde_json::json!([{ "id": "a1" }, { "targetPrice": 1 }]);
        let merged = apply_alert_mutations_to(disk, &[], &["".to_string()]);
        assert_eq!(merged.as_array().unwrap().len(), 2);
    }

    #[test]
    fn apply_alert_mutations_applies_a_snooze_patch_only() {
        let disk = serde_json::json!([{
            "id": "a1", "targetPrice": 500, "isActive": true,
            "triggeredAt": "2026-06-02T00:00:00.000Z"
        }]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({ "snoozedUntil": "2026-07-01T00:00:00.000Z" }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(
            a["snoozedUntil"],
            serde_json::json!("2026-07-01T00:00:00.000Z")
        );
        assert_eq!(a["targetPrice"], serde_json::json!(500));
        assert_eq!(
            a["triggeredAt"],
            serde_json::json!("2026-06-02T00:00:00.000Z")
        );
    }
}
