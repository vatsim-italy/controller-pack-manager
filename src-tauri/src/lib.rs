mod airac;
mod app;
mod commands;
mod config;
mod github_http;
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_detected_euroscope_config_dir,
            get_detected_installed_airac_version,
            is_new_airac_version_available,
            get_existing_profiles,
            get_hoppie_code,
            update_hoppie_code,
            has_imported_airac_sector_files,
            import_airac_sector_zip,
            update_airac_version,
            get_latest_airac_changelog,
            update_plugin_version,
            get_latest_plugin_changelog,
            set_github_access_token,
            clear_github_access_token,
            has_github_access_token,
            is_plugin_dev_releases_opted_in,
            set_plugin_dev_releases_opt_in_command,
            get_installed_plugin_version,
            get_latest_plugin_installable_version,
            update_profile,
            delete_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
