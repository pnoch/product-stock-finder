use tauri::Manager;

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

use std::fs;
use std::path::PathBuf;

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
        "csv" => {
            Err("CSV import not yet implemented".to_string())
        }
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

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

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            send_notification,
            get_app_data_dir,
            export_watchlist,
            import_watchlist,
            write_file,
            read_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
