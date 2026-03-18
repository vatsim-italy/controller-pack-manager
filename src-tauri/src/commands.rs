use crate::airac::{run_get_latest_airac_changelog, run_update_airac_version};
use crate::github_http::{clear_stored_github_token, resolve_github_token, store_github_token};
use crate::plugin::{
    get_installed_plugin_version as read_installed_plugin_version,
    get_latest_plugin_installable_version as read_latest_plugin_installable_version,
    get_plugin_dev_releases_opt_in as read_plugin_dev_releases_opt_in,
    run_get_latest_plugin_changelog, run_update_plugin_version,
    set_plugin_dev_releases_opt_in as write_plugin_dev_releases_opt_in,
};
use crate::profile::{delete_profile_and_reload, update_profile_and_reload, Profile};
use crate::AppState;

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
