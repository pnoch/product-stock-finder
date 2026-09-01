mod scrapers;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
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

fn convert_price(amount: f64, from_currency: &str, to_currency: &str) -> Option<f64> {
    let from_rate = EXCHANGE_RATES
        .iter()
        .find(|(c, _)| *c == from_currency)
        .map(|(_, r)| *r)?;
    let to_rate = EXCHANGE_RATES
        .iter()
        .find(|(c, _)| *c == to_currency)
        .map(|(_, r)| *r)?;
    if !from_rate.is_finite() || !to_rate.is_finite() || from_rate <= 0.0 || to_rate <= 0.0 {
        return None;
    }
    let v = (amount / from_rate) * to_rate;
    if v.is_finite() { Some(v) } else { None }
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

// ─── Global State ────────────────────────────────────────────────────────────

static POLLER_RUNNING: Mutex<bool> = Mutex::new(false);
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
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let mut notification = app
        .notification()
        .builder()
        .title(&title)
        .body(&body);

    if sound {
        notification = notification.sound("default".to_string());
    }

    notification.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ─── Import/Export ───────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
struct ExportData {
    version: u32,
    exported_at: String,
    watchlist: serde_json::Value,
    alerts: serde_json::Value,
    reminders: serde_json::Value,
    settings: serde_json::Value,
}

fn validate_import_schema(data: &ExportData) -> Result<(), String> {
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
                let lo = l
                    .as_object()
                    .ok_or(format!("watchlist[{}].listings[{}] must be an object", i, j))?;
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
                    let p = price
                        .as_f64()
                        .ok_or(format!("watchlist[{}].listings[{}].price must be a number", i, j))?;
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
#[tauri::command]
fn read_watchlist(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    read_json_file(&data_dir, "watchlist_products")
}

#[tauri::command]
fn export_watchlist(
    app: tauri::AppHandle,
    format: String,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let watchlist = read_json_file(&data_dir, "watchlist_products")?;
    let alerts = read_json_file(&data_dir, "price_alerts")?;
    let reminders = read_json_file(&data_dir, "back_order_reminders")?;
    let settings = read_json_file(&data_dir, "app_settings")?;

    let export = ExportData {
        version: 1,
        exported_at: current_iso_timestamp(),
        watchlist,
        alerts,
        reminders,
        settings,
    };

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?,
        "csv" => export_to_csv(&export)?,
        _ => return Err(format!("Unsupported format: {}", format)),
    };

    Ok(content)
}

#[tauri::command]
fn import_watchlist(
    app: tauri::AppHandle,
    content: String,
    format: String,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

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

            write_json_file(&data_dir, "watchlist_products", &import.watchlist)?;
            write_json_file(&data_dir, "price_alerts", &import.alerts)?;
            write_json_file(&data_dir, "back_order_reminders", &import.reminders)?;
            write_json_file(&data_dir, "app_settings", &import.settings)?;

            Ok("Import successful".to_string())
        }
        "csv" => Err("CSV import not yet implemented".to_string()),
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

// ─── OAuth (localhost loopback) ───────────────────────────────────────────────

fn parse_query_params(query: &str) -> std::collections::HashMap<String, String> {
    let mut params = std::collections::HashMap::new();
    let path = query.split_whitespace().nth(1).unwrap_or(query);
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
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn start_oauth(login_url: String) -> Result<serde_json::Value, String> {
    open_system_browser(&login_url)?;

    let listener = TcpListener::bind("127.0.0.1:3420")
        .await
        .map_err(|e| format!("Failed to bind OAuth callback listener: {e}"))?;

    let (mut socket, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "OAuth callback timed out after 120 seconds".to_string())?
    .map_err(|e| format!("Failed to accept OAuth callback: {e}"))?;

    let mut buf = [0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read OAuth callback: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    let request_line = request.lines().next().unwrap_or_default().to_string();
    let params = parse_query_params(&request_line);

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

    let session_token = params.get("sessionToken").cloned().unwrap_or_default();
    if session_token.is_empty() {
        return Err("OAuth callback did not include a session token".to_string());
    }

    let user = params.get("user").cloned().unwrap_or_default();
    Ok(serde_json::json!({ "sessionToken": session_token, "user": user }))
}

// ─── Background Polling ──────────────────────────────────────────────────────

#[tauri::command]
async fn start_price_poller(app: tauri::AppHandle, interval_minutes: u64, api_base_url: String) -> Result<String, String> {
    let mut running = POLLER_RUNNING.lock().map_err(|e| e.to_string())?;
    if *running {
        return Ok("Poller already running".to_string());
    }
    *running = true;
    drop(running);

    let handle = app.clone();
    let backfill_url = api_base_url.clone();
    tauri::async_runtime::spawn(async move {
        let _ = backfill_local_history(handle.clone(), backfill_url.clone()).await;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_minutes * 60));
        interval.tick().await;
        loop {
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
fn check_price_drops(app: tauri::AppHandle) -> Result<String, String> {
    let _guard = PRICE_CHECK_LOCK.blocking_lock();
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    check_price_drops_inner(&app, &data_dir)
}

fn check_price_drops_inner(app: &tauri::AppHandle, data_dir: &PathBuf) -> Result<String, String> {
    let alerts_val = read_json_file(data_dir, "price_alerts")?;
    let watchlist_val = read_json_file(data_dir, "watchlist_products")?;

    let alerts: Vec<serde_json::Value> = alerts_val
        .as_array()
        .cloned()
        .unwrap_or_default();
    let watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

    // Compute which alerts have dropped below target in a single pass.
    // Returns (alert_index, best_price) for each triggered alert.
    let mut triggered: Vec<(usize, f64)> = Vec::new();
    let mut notifications: Vec<(String, String)> = Vec::new();
    let now_ts = current_iso_timestamp();

    for (idx, alert) in alerts.iter().enumerate() {
        let is_active = alert.get("isActive").and_then(|v| v.as_bool()).unwrap_or(false);
        let triggered_at = alert.get("triggeredAt").and_then(|v| v.as_str());
        if !is_active || triggered_at.is_some() {
            continue;
        }
        if let Some(snoozed_until) = alert.get("snoozedUntil").and_then(|v| v.as_str()) {
            if snoozed_until > now_ts.as_str() {
                continue;
            }
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
            l.get("stockStatus").and_then(|v| v.as_str()) != Some("out_of_stock")
        }).fold(f64::INFINITY, |best, listing| {
            let price = listing.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            if price <= 0.0 {
                return best;
            }
            let currency = listing.get("currency").and_then(|v| v.as_str()).unwrap_or("USD");
            let converted = match convert_price(price, currency, alert_currency) {
                Some(v) => v,
                None => return best,
            };
            if converted < best { converted } else { best }
        });

        if best_price.is_finite() && best_price <= target_price {
            let product_name = product.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Product");
            let body = format!(
                "{} is now {} — below your target of {}!",
                product_name,
                format_price(best_price, alert_currency),
                format_price(target_price, alert_currency)
            );
            notifications.push(("💸 Price Drop Alert!".to_string(), body));
            triggered.push((idx, best_price));
        }
    }

    if !notifications.is_empty() {
        use tauri_plugin_notification::NotificationExt;
        for (title, body) in &notifications {
            let _ = app.notification().builder().title(title).body(body).sound("default".to_string()).show();
        }

        // Deactivate the triggered alerts in a single pass
        let mut updated_alerts = alerts.clone();
        for (idx, best_price) in &triggered {
            if let Some(alert) = updated_alerts.get_mut(*idx) {
                if let Some(obj) = alert.as_object_mut() {
                    obj.insert("isActive".to_string(), serde_json::Value::Bool(false));
                    obj.insert("triggeredAt".to_string(), serde_json::Value::String(current_iso_timestamp()));
                    obj.insert("triggeredPrice".to_string(), serde_json::json!(best_price));
                }
            }
        }

        let updated_val = serde_json::Value::Array(updated_alerts);
        write_json_file(data_dir, "price_alerts", &updated_val)?;
    }

    Ok(format!("Price check completed. {} alerts triggered.", triggered.len()))
}

#[tauri::command]
fn stop_price_poller() -> Result<String, String> {
    let mut running = POLLER_RUNNING.lock().map_err(|e| e.to_string())?;
    *running = false;
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
async fn check_all_prices(products: Vec<WatchedProduct>, api_base_url: String) -> Result<Vec<scrapers::ScrapeJobResult>, String> {
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
                let (scrape_result, history) = match fetch_server_price(&api_url, &dist, &model).await {
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
async fn backfill_local_history(app: tauri::AppHandle, api_base_url: String) -> Result<u64, String> {
    if api_base_url.is_empty() {
        return Ok(0);
    }
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let watchlist_val = read_json_file(&data_dir, "watchlist_products")?;
    let watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut uploaded = 0u64;
    for product in &watchlist {
        let model_number = product.get("modelNumber").and_then(|v| v.as_str()).unwrap_or("");
        if model_number.is_empty() {
            continue;
        }
        let listings = product.get("listings").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        for listing in &listings {
            let distributor_id = listing.get("distributorId").and_then(|v| v.as_str()).unwrap_or("");
            let history = listing.get("priceHistory").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            if distributor_id.is_empty() || history.is_empty() {
                continue;
            }
            if upload_server_history(&api_base_url, distributor_id, model_number, &history).await.is_ok() {
                uploaded += 1;
            }
        }
    }
    Ok(uploaded)
}

#[tauri::command]
async fn fetch_price_insight(api_base_url: String, product_id: String) -> Result<Option<serde_json::Value>, String> {
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

#[tauri::command]
async fn fetch_product_image(api_base_url: String, product_id: String) -> Result<Option<serde_json::Value>, String> {
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

async fn upload_server_history(
    api_base_url: &str,
    distributor_id: &str,
    model_number: &str,
    points: &[serde_json::Value],
) -> Result<(), String> {
    if api_base_url.is_empty() {
        return Ok(());
    }
    let input = serde_json::json!({
        "json": {
            "distributorId": distributor_id,
            "modelNumber": model_number,
            "points": points,
        }
    });
    let url = format!(
        "{}/api/trpc/prices.uploadHistory",
        api_base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&input)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("uploadHistory failed: {}", resp.status()));
    }
    Ok(())
}

async fn scrape_distributor(
    distributor_id: &str,
    model: &str,
) -> Result<scrapers::ScrapeResult, String> {
    match distributor_id {
        "server2u" | "server2u-my" => scrapers::server2u::scrape(model, false).await,
        "linitx-uk" => scrapers::linitx::scrape(model, false).await,
        "interprojekt-pl" => scrapers::interprojekt::scrape(model, false).await,
        "nasstore-eu" => scrapers::nasstore::scrape(model, false).await,
        "aerial-gr" => scrapers::aerial::scrape(model, false).await,
        "mikrotikstore-de" => scrapers::mikrotikstore::scrape(model, false).await,
        "miro-za" => scrapers::miro::scrape(model, false).await,
        "gearup-ae" => scrapers::gearup::scrape(model, false).await,
        "balticnetworks-us" => scrapers::balticnetworks::scrape(model, false).await,
        "linktechs-us" => scrapers::linktechs::scrape(model, false).await,
        "winncom-us" => scrapers::winncom::scrape(model, false).await,
        "bhphoto-us" => scrapers::bhphoto::scrape(model, false).await,
        "duxtel-au" => scrapers::duxtel::scrape(model, false).await,
        "wisp-au" => scrapers::wisp::scrape(model, false).await,
        "pbtech-nz" => scrapers::pbtech::scrape(model, false).await,
        "gowifi-nz" => scrapers::gowifi::scrape(model, false).await,
        "getic-gr" => scrapers::getic::scrape(model, false).await,
        "100mega-cz" => scrapers::mega::scrape(model, false).await,
        "hellascom-gr" => scrapers::hellascom::scrape(model, false).await,
        "rocnoc-us" => scrapers::rocnoc::scrape(model, false).await,
        "networkdevices-us" => scrapers::networkdevices::scrape(model, false).await,
        "flytec-us" => scrapers::flytec::scrape(model, false).await,
        "mbsiwav-ca" => scrapers::mbsiwav::scrape(model, false).await,
        "multilink-us" => scrapers::multilink::scrape(model, false).await,
        "neobits-us" => scrapers::neobits::scrape(model, false).await,
        _ => Err(format!("No scraper for distributor: {}", distributor_id)),
    }
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
    let price = snapshot.get("price")?.as_f64()?;
    let currency = snapshot.get("currency")?.as_str()?.to_string();
    let stock_status = snapshot.get("stockStatus").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let expected_date = snapshot.get("expectedDate").and_then(|v| v.as_str()).map(|s| s.to_string());
    let url = snapshot.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let history = data.get("history").and_then(|v| v.as_array()).cloned().unwrap_or_default();
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

static BLOCKED_MARKERS: &[&str] = &[
    "403 Forbidden",
    "Access Denied",
    "cf-browser-verification",
    "Checking your browser",
    "Just a moment",
    "Attention Required",
    "challenge-platform",
    "px-captcha",
    "captcha-delivery.com",
];

fn is_blocked_error(msg: &str) -> bool {
    BLOCKED_MARKERS.iter().any(|m| msg.contains(m))
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

#[tauri::command]
async fn check_distributor_health(app: tauri::AppHandle) -> Result<Vec<DistributorHealth>, String> {
    let model = "CRS326";
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
        let progress = (((idx as u32 + 1) * 100) / total) as u32;
        let _ = app.emit(
            "health-check-progress",
            serde_json::json!({ "progress": progress, "distributorId": distributor_id }),
        );
    }

    Ok(results)
}

// ─── Full Price Check (scrape → compare → notify → update tray) ─────────────

async fn run_full_price_check(app: tauri::AppHandle, api_base_url: String) -> Result<String, String> {
    let _guard = PRICE_CHECK_LOCK.lock().await;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let watchlist_val = read_json_file(&data_dir, "watchlist_products")?;
    let watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

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
            update_listing_price(&data_dir, &job_result.product_id, &job_result.distributor_id, scrape, &job_result.history)?;
            let _ = app.emit("listing-updated", serde_json::json!({
                "productId": job_result.product_id,
                "distributorId": job_result.distributor_id,
                "price": scrape.price,
                "currency": scrape.currency,
                "stockStatus": scrape.stock_status,
                "expectedDate": scrape.expected_date,
                "lastChecked": current_iso_timestamp(),
            }));
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
    let mut watchlist: Vec<serde_json::Value> = watchlist_val
        .as_array()
        .cloned()
        .unwrap_or_default();

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
                obj.insert("stockStatus".to_string(), serde_json::json!(scrape.stock_status));
                if let Some(expected) = &scrape.expected_date {
                    obj.insert("expectedDate".to_string(), serde_json::json!(expected));
                } else {
                    obj.remove("expectedDate");
                }
                obj.insert("lastChecked".to_string(), serde_json::json!(current_iso_timestamp()));

                // Merge server history (union by day, newest wins) then append today's point,
                // pruning to a 90-day window.
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let cutoff_day = iso_date_from_secs(now.saturating_sub(90 * 86400));
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

fn read_json_file(data_dir: &PathBuf, key: &str) -> Result<serde_json::Value, String> {
    let path = data_dir.join(format!("{}.json", key));
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(serde_json::Value::Null)
    }
}

fn write_json_file(
    data_dir: &PathBuf,
    key: &str,
    value: &serde_json::Value,
) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let path = data_dir.join(format!("{}.json", key));
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn export_to_csv(_export: &ExportData) -> Result<String, String> {
    Err("CSV export not yet implemented".to_string())
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
        p.get("date")
            .and_then(|d| d.as_str())
            .map(iso_date_prefix)
            == Some(today.as_str())
    });

    match same_day {
        Some(existing) => *existing = point,
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

    let active_alerts = alerts_val
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|a| {
                    a.get("isActive").and_then(|v| v.as_bool()).unwrap_or(false)
                        && a.get("triggeredAt").and_then(|v| v.as_str()).is_none()
                })
                .count()
        })
        .unwrap_or(0);

    let active_reminders = reminders_val
        .as_array()
        .map(|r| r.len())
        .unwrap_or(0);

    let total = active_alerts + active_reminders;

    if let Some(tray) = app.tray_by_id("main") {
        let badge_text = if total > 0 {
            total.to_string()
        } else {
            String::new()
        };
        let _ = tray.set_title(Some(&badge_text));
        let tooltip = format!(
            "Product Stock Finder — {} active alert{}",
            total,
            if total == 1 { "" } else { "s" }
        );
        let _ = tray.set_tooltip(Some(&tooltip));
    }

    Ok(format!("Tray badge updated: {} active", total))
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
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

            let _tray = TrayIconBuilder::new()
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
                            let _ = run_full_price_check(app_handle, String::new()).await;
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
            get_app_data_dir,
            read_watchlist,
            export_watchlist,
            import_watchlist,
            start_price_poller,
            check_price_drops,
            stop_price_poller,
            update_tray_badge,
            check_all_prices,
            backfill_local_history,
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
}
