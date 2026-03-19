use crate::airac::{
    run_get_latest_airac_changelog, run_has_imported_sector_files,
    run_import_sector_files_from_zip, run_update_airac_version,
};
use crate::github_http::{clear_stored_github_token, resolve_github_token, store_github_token};
use crate::plugin::{
    get_installed_plugin_version as read_installed_plugin_version,
    get_latest_plugin_installable_version as read_latest_plugin_installable_version,
    get_plugin_dev_releases_opt_in as read_plugin_dev_releases_opt_in,
    run_get_latest_plugin_changelog, run_update_plugin_version,
    set_plugin_dev_releases_opt_in as write_plugin_dev_releases_opt_in,
};
use crate::profile::{
    delete_profile_and_reload, patch_profile_settings_lines, update_profile_and_reload, Profile,
};
use crate::settings::ListConfig;
use crate::topsky::run_update_hoppie_code;
use crate::AppState;
use std::env;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn get_detected_euroscope_config_dir(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let lock = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub fn get_detected_installed_airac_version(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let lock = state
        .installed_airac_version
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub fn is_new_airac_version_available(
    state: tauri::State<'_, AppState>,
) -> Result<Option<bool>, String> {
    let lock = state
        .new_airac_version_available
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub fn get_existing_profiles(
    state: tauri::State<'_, AppState>,
) -> Result<Option<Vec<Profile>>, String> {
    let lock = state.profiles.lock().map_err(|error| error.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub fn get_hoppie_code(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    let lock = state
        .hoppie_code
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub async fn update_hoppie_code(
    hoppie_code: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let updated_code = hoppie_code.trim().to_string();
    if updated_code.is_empty() {
        return Err("hoppie code cannot be empty".to_string());
    }

    let code_for_write = updated_code.clone();
    tauri::async_runtime::spawn_blocking(move || run_update_hoppie_code(code_for_write))
        .await
        .map_err(|error| format!("update hoppie task failed: {}", error))??;

    let mut hoppie_lock = state
        .hoppie_code
        .lock()
        .map_err(|error| error.to_string())?;
    *hoppie_lock = Some(updated_code);

    Ok(())
}

#[tauri::command]
pub async fn update_airac_version(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    let existing_profiles = state
        .profiles
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .unwrap_or_default();

    let hoppie_code = state
        .hoppie_code
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| {
            "unable to patch hoppie code: no hoppie code stored in app state".to_string()
        })?;

    tauri::async_runtime::spawn_blocking(move || {
        run_update_airac_version(euroscope_config_dir, existing_profiles, hoppie_code)
    })
    .await
    .map_err(|error| format!("update task failed: {}", error))?
}

#[tauri::command]
pub fn has_imported_airac_sector_files() -> Result<bool, String> {
    run_has_imported_sector_files()
}

#[tauri::command]
pub async fn import_airac_sector_zip(zip_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_import_sector_files_from_zip(zip_path))
        .await
        .map_err(|error| format!("import sector zip task failed: {}", error))?
}

#[tauri::command]
pub async fn get_latest_airac_changelog() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(run_get_latest_airac_changelog)
        .await
        .map_err(|error| format!("changelog task failed: {}", error))?
}

#[tauri::command]
pub async fn get_latest_plugin_changelog() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(run_get_latest_plugin_changelog)
        .await
        .map_err(|error| format!("plugin changelog task failed: {}", error))?
}

#[tauri::command]
pub async fn update_plugin_version() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(run_update_plugin_version)
        .await
        .map_err(|error| format!("plugin update task failed: {}", error))?
}

#[tauri::command]
pub fn set_github_access_token(token: String) -> Result<(), String> {
    store_github_token(&token)
}

#[tauri::command]
pub fn clear_github_access_token() -> Result<(), String> {
    clear_stored_github_token()
}

#[tauri::command]
pub fn has_github_access_token() -> Result<bool, String> {
    Ok(resolve_github_token().is_some())
}

#[tauri::command]
pub fn is_plugin_dev_releases_opted_in() -> Result<bool, String> {
    read_plugin_dev_releases_opt_in()
}

#[tauri::command]
pub fn set_plugin_dev_releases_opt_in_command(opt_in: bool) -> Result<(), String> {
    write_plugin_dev_releases_opt_in(opt_in)
}

#[tauri::command]
pub fn get_installed_plugin_version() -> Result<Option<String>, String> {
    read_installed_plugin_version()
}

#[tauri::command]
pub fn get_latest_plugin_installable_version() -> Result<Option<String>, String> {
    read_latest_plugin_installable_version()
}

#[tauri::command]
pub async fn update_profile(
    original_name: String,
    new_name: String,
    real_name: Option<String>,
    certificate: Option<String>,
    server: Option<String>,
    connect_to_vatsim: Option<bool>,
    proxy_server: Option<String>,
    configured_lists: Vec<(String, String)>,
    clone_from: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Profile>, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    let updated_profiles = update_profile_and_reload(
        &euroscope_config_dir,
        original_name,
        new_name,
        real_name,
        certificate,
        server,
        connect_to_vatsim,
        proxy_server,
        configured_lists,
        clone_from,
    )?;

    let mut profiles_lock = state.profiles.lock().map_err(|error| error.to_string())?;
    *profiles_lock = Some(updated_profiles.clone());

    Ok(updated_profiles)
}

#[tauri::command]
pub async fn delete_profile(
    profile_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Profile>, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    let updated_profiles = delete_profile_and_reload(&euroscope_config_dir, profile_name)?;

    let mut profiles_lock = state.profiles.lock().map_err(|error| error.to_string())?;
    *profiles_lock = Some(updated_profiles.clone());

    Ok(updated_profiles)
}

#[tauri::command]
pub fn get_list_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Option<Vec<ListConfig>>, String> {
    state
        .list_configs
        .lock()
        .map_err(|error| error.to_string())
        .map(|lock| lock.clone())
}

#[tauri::command]
pub async fn save_layout(
    profile_name: String,
    list_configs: Vec<ListConfig>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        run_save_layout(&euroscope_config_dir, &profile_name, list_configs)
    })
    .await
    .map_err(|error| format!("save layout task failed: {}", error))?
}

fn to_snake_case(input: &str) -> String {
    input
        .replace(|c: char| c.is_whitespace() || !c.is_alphanumeric(), "_")
        .to_lowercase()
        .split('_')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

fn run_save_layout(
    euroscope_config_dir: &str,
    profile_name: &str,
    list_configs: Vec<ListConfig>,
) -> Result<(), String> {
    // Convert profile name to snake_case for file paths (handles spaces and special chars)
    let profile_name_snake = to_snake_case(profile_name);

    // Step 1: Create custom-profiles directory structure
    let appdata = env::var("APPDATA")
        .map_err(|error| format!("unable to get APPDATA environment variable: {}", error))?;

    let custom_profiles_dir = PathBuf::from(&appdata)
        .join("controller-pack-manager")
        .join("custom-profiles")
        .join(&profile_name_snake);

    fs::create_dir_all(&custom_profiles_dir)
        .map_err(|error| format!("unable to create custom profiles directory: {}", error))?;

    // Step 2: Create Lists.txt with serialized configurations
    let lists_txt_path = custom_profiles_dir.join("Lists.txt");
    let lists_content = list_configs
        .iter()
        .map(|config| config.to_string())
        .collect::<Vec<_>>()
        .join("\n\n");

    fs::write(&lists_txt_path, &lists_content)
        .map_err(|error| format!("unable to write Lists.txt: {}", error))?;

    // Step 3: Copy to EuroScope Settings/generated directory
    let euroscope_generated_dir = PathBuf::from(euroscope_config_dir)
        .join("LIXX")
        .join("Settings")
        .join("generated")
        .join(&profile_name_snake);

    fs::create_dir_all(&euroscope_generated_dir)
        .map_err(|error| format!("unable to create euroscope generated directory: {}", error))?;

    let euroscope_lists_txt_path = euroscope_generated_dir.join("Lists.txt");
    fs::copy(&lists_txt_path, &euroscope_lists_txt_path)
        .map_err(|error| format!("unable to copy Lists.txt to euroscope directory: {}", error))?;

    // Step 4: Patch the profile file with Settings entries
    let mut profile_path = PathBuf::from(euroscope_config_dir);

    // Add .prf extension if not already present
    let profile_filename = if profile_name.ends_with(".prf") {
        profile_name.to_string()
    } else {
        format!("{}.prf", profile_name)
    };

    profile_path.push(&profile_filename);

    // Extract list IDs from the configurations
    let list_ids: Vec<String> = list_configs
        .iter()
        .map(|config| config.id.clone())
        .collect();

    // Build the settings path for the profile (relative EuroScope path with snake_case)
    let settings_path = format!(
        "\\LIXX\\Settings\\generated\\{}\\Lists.txt",
        profile_name_snake
    );

    patch_profile_settings_lines(&profile_path, list_ids, &settings_path)?;

    Ok(())
}
