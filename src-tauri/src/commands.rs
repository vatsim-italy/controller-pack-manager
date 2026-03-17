use crate::app::Profile;
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
