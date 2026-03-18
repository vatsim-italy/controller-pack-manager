mod airac;
mod app;
mod commands;
mod plugin;
mod profile;
mod topsky;
mod utils;

use app::AppState;
use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_detected_euroscope_config_dir,
            get_detected_installed_airac_version,
            is_new_airac_version_available,
            get_existing_profiles,
            get_hoppie_code,
            update_airac_version,
            get_latest_airac_changelog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
