mod scrapers;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

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

// ─── Global State ────────────────────────────────────────────────────────────

static POLLER_RUNNING: Mutex<bool> = Mutex::new(false);

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
            let import: ExportData =
                serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

            if import.version != 1 {
                return Err(format!("Unsupported version: {}", import.version));
            }

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

// ─── Background Polling ──────────────────────────────────────────────────────

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
        let _ = update_tray_badge(handle.clone());

        std::thread::sleep(std::time::Duration::from_secs(interval_minutes * 60));
    });

    Ok(format!(
        "Price poller started with {} minute interval",
        interval_minutes
    ))
}

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

    if !notifications.is_empty() {
        use tauri_plugin_notification::NotificationExt;
        for (title, body) in &notifications {
            let _ = app.notification().builder().title(title).body(body).sound("default".to_string()).show();
        }

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
async fn check_all_prices(products: Vec<WatchedProduct>) -> Result<Vec<scrapers::ScrapeJobResult>, String> {
    let mut results = Vec::new();
    for product in products {
        for distributor_id in product.distributor_ids {
            let start = std::time::Instant::now();
            let scrape_result = match distributor_id.as_str() {
                "server2u" => scrapers::server2u::scrape(&product.model_number).await,
                _ => Err(format!("No scraper for distributor: {}", distributor_id)),
            };
            let duration_ms = start.elapsed().as_millis() as u64;
            let (result, error) = match scrape_result {
                Ok(r) => (Some(r), None),
                Err(e) => (None, Some(e)),
            };
            results.push(scrapers::ScrapeJobResult {
                distributor_id,
                product_id: product.id.clone(),
                result,
                error,
                duration_ms,
            });
        }
    }
    Ok(results)
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
    format!("{:04}-{:02}-{:02}T00:00:00Z", year, month, day)
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
                        let _ = check_price_drops(app.clone());
                        let _ = update_tray_badge(app.clone());
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
            export_watchlist,
            import_watchlist,
            start_price_poller,
            check_price_drops,
            stop_price_poller,
            update_tray_badge,
            check_all_prices
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
