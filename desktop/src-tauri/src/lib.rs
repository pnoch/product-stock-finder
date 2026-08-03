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
        notification = notification.sound(Some("default"));
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
        exported_at: chrono_free_placeholder(),
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

fn export_to_csv(_export: &ExportData) -> Result<String, String> {
    Err("CSV export not yet implemented".to_string())
}

fn chrono_free_placeholder() -> String {
    "2026-01-01T00:00:00Z".to_string()
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
            import_watchlist
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
