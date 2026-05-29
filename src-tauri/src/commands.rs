use crate::airac::{
    run_get_latest_airac_changelog, run_get_latest_airac_release_digest,
    run_get_latest_airac_version, run_has_imported_sector_files, run_import_sector_files_from_zip,
    run_update_airac_version,
};
use crate::config::{read_config_or_default, update_config};
use crate::plugin::{
    get_installed_plugin_version as read_installed_plugin_version,
    get_latest_plugin_installable_version as read_latest_plugin_installable_version,
    get_plugin_dev_releases_opt_in as read_plugin_dev_releases_opt_in, get_plugin_releases,
    run_get_latest_plugin_changelog, run_update_plugin_version,
    set_plugin_dev_releases_opt_in as write_plugin_dev_releases_opt_in,
};
use crate::profile::{
    delete_profile_and_reload, patch_profile_screen_settings_line, patch_profile_settings_lines,
    update_profile_and_reload, Profile,
};
use crate::settings::{ControllerListConfig, ListConfig, ScreenConfig, TitleBarConfig};
use crate::topsky::run_update_hoppie_code;
use crate::AppState;
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn should_skip_startup_update_checks() -> bool {
    env::var("SKIP_STARTUP_UPDATE_CHECKS")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
        || env::var("GITHUB_ACTIONS")
            .map(|value| value.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
        || env::var("CI")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
}

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
pub fn refresh_detected_installed_airac_version(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let euroscope_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone();

    if let Some(dir) = euroscope_dir {
        let airac_file = std::path::PathBuf::from(&dir).join("LIXX").join("AIRAC_VERSION.txt");
        if let Ok(content) = std::fs::read_to_string(&airac_file) {
            let detected = content.split(' ').skip(1).next().map(|v| v.trim().to_string());

            // Update in-memory AppState
            let mut lock = state
                .installed_airac_version
                .lock()
                .map_err(|error| error.to_string())?;
            let previous = lock.clone();
            *lock = detected.clone();

            // If detected version differs from stored config, clear any stored digest
            // so update checks will re-evaluate using the detected version.
            if detected != previous {
                let _ = update_config(|config| {
                    config.installed_airac_version = detected.clone();
                    config.installed_airac_digest = None;
                    config.installed_airac_digest_source = None;
                });
            }

            return Ok(detected);
        }
    }

    // No euroscope dir or file; clear stored installed version
    let mut lock = state
        .installed_airac_version
        .lock()
        .map_err(|error| error.to_string())?;
    *lock = None;
    Ok(None)
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
pub async fn refresh_airac_update_status(
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let skip_update_checks = env::var("SKIP_STARTUP_UPDATE_CHECKS")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
        || env::var("GITHUB_ACTIONS")
            .map(|value| value.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
        || env::var("CI")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

    if skip_update_checks {
        let mut available = state
            .new_airac_version_available
            .lock()
            .map_err(|error| error.to_string())?;
        *available = Some(false);
        println!("[AIRAC] Skipping update status check in CI/build environment");
        return Ok(false);
    }

    let installed_version = state
        .installed_airac_version
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let latest_release = tauri::async_runtime::spawn_blocking(run_get_latest_airac_release_digest)
        .await
        .map_err(|error| format!("AIRAC digest check task failed: {}", error))??;

    let config = read_config_or_default()?;
    let installed_digest = config.installed_airac_digest.clone();
    let digest_source = config.installed_airac_digest_source.clone();
    let update_available = if digest_source.as_deref() == Some("hash_txt") {
        installed_digest
            .as_deref()
            .map(|digest| digest.trim() != latest_release.digest.trim())
            .unwrap_or(true)
    } else if installed_version
        .as_deref()
        .is_some_and(|version| version.trim() == latest_release.version.trim())
    {
        let latest_version = latest_release.version.clone();
        let latest_digest = latest_release.digest.clone();
        update_config(|config| {
            config.installed_airac_version = Some(latest_version);
            config.installed_airac_digest = Some(latest_digest);
            config.installed_airac_digest_source = Some("hash_txt".to_string());
        })
        .map_err(|error| format!("unable to migrate AIRAC digest status: {}", error))?;
        false
    } else if let Some(installed_version) = installed_version.as_deref() {
        AppState::is_latest_newer(installed_version, &latest_release.version).unwrap_or(true)
    } else {
        true
    };

    println!(
        "[AIRAC] Update status: installed_version={:?}, installed_digest={:?}, digest_source={:?}, latest_version={}, latest_digest={}, update_available={}",
        installed_version, installed_digest, digest_source, latest_release.version, latest_release.digest, update_available
    );

    let mut available = state
        .new_airac_version_available
        .lock()
        .map_err(|error| error.to_string())?;
    *available = Some(update_available);

    Ok(update_available)
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

    // If no hoppie code is stored in app state, proceed with an empty string
    // — the installer will skip patching hoppie code when empty.
    let hoppie_code = state
        .hoppie_code
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .unwrap_or_default();

    let (changelog, version) = tauri::async_runtime::spawn_blocking(move || {
        run_update_airac_version(euroscope_config_dir, existing_profiles, hoppie_code)
    })
    .await
    .map_err(|error| format!("update task failed: {}", error))??;

    {
        let mut installed = state
            .installed_airac_version
            .lock()
            .map_err(|e| e.to_string())?;
        *installed = Some(version);

        let mut available = state
            .new_airac_version_available
            .lock()
            .map_err(|e| e.to_string())?;
        *available = Some(false);
    }

    Ok(changelog)
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
pub async fn get_latest_airac_version() -> Result<String, String> {
    if should_skip_startup_update_checks() {
        println!("[AIRAC] Skipping latest AIRAC version fetch in CI/build environment");
        return Ok("unknown".to_string());
    }

    tauri::async_runtime::spawn_blocking(run_get_latest_airac_version)
        .await
        .map_err(|error| format!("latest AIRAC version task failed: {}", error))?
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
pub fn is_plugin_dev_releases_opted_in() -> Result<bool, String> {
    read_plugin_dev_releases_opt_in()
}

#[tauri::command]
pub fn set_plugin_dev_releases_opt_in_command(opt_in: bool) -> Result<(), String> {
    write_plugin_dev_releases_opt_in(opt_in)
}

#[tauri::command]
pub fn get_installed_plugin_version() -> Result<Option<String>, String> {
    if should_skip_startup_update_checks() {
        println!("[Plugin] Skipping installed plugin version lookup in CI/build environment");
        return Ok(None);
    }

    read_installed_plugin_version()
}

#[tauri::command]
pub fn get_latest_plugin_installable_version() -> Result<Option<String>, String> {
    read_latest_plugin_installable_version()
}

#[tauri::command]
pub fn set_euroscope_config_dir(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    let normalized = path.trim().to_string();
    if normalized.is_empty() {
        return Err("euroscope config folder cannot be empty".to_string());
    }

    if !std::path::Path::new(&normalized).is_dir() {
        return Err(format!("euroscope config folder does not exist: {}", normalized));
    }

    state.refresh_euroscope_config_folder(Some(normalized))
}

#[tauri::command]
pub fn clear_euroscope_config_dir_override(
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.refresh_euroscope_config_folder(None)
}

#[tauri::command]
pub async fn fetch_plugin_releases() -> Result<crate::plugin::PluginApiResponse, String> {
    tauri::async_runtime::spawn_blocking(get_plugin_releases)
        .await
        .map_err(|error| format!("fetch plugin releases task failed: {}", error))?
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
    startup_asr: Option<String>,
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
        startup_asr,
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
) -> Result<String, String> {
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
) -> Result<String, String> {
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
        .join("\n");

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

    Ok(format!(
        "Layout saved successfully for profile '{}'",
        profile_name
    ))
}

#[tauri::command]
pub async fn load_layout(
    profile_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ListConfig>, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        run_load_layout(&euroscope_config_dir, &profile_name)
    })
    .await
    .map_err(|error| format!("load layout task failed: {}", error))?
}

fn parse_list_configs_from_content(content: &str) -> Vec<ListConfig> {
    content
        .split("END")
        .map(|block| block.trim())
        .filter(|block| !block.is_empty())
        .filter_map(|block| ListConfig::parse(block).ok())
        .collect()
}

fn resolve_settings_reference_path(euroscope_config_dir: &str, settings_path: &str) -> PathBuf {
    let raw = settings_path.trim();
    let candidate = PathBuf::from(raw);

    if candidate.is_absolute() {
        return candidate;
    }

    let cleaned = raw.trim_start_matches(['\\', '/']);
    let mut resolved = PathBuf::from(euroscope_config_dir);
    for segment in cleaned
        .split(['\\', '/'])
        .filter(|segment| !segment.is_empty())
    {
        resolved.push(segment);
    }

    resolved
}

fn parse_profile_settings_refs(profile_content: &str) -> Vec<(String, String)> {
    profile_content
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 3 || !parts[0].eq_ignore_ascii_case("settings") {
                return None;
            }

            let list_id = parts[1].strip_prefix("Settingsfile")?.to_string();
            let path = parts[2..].join(" ");

            if list_id.is_empty() || path.trim().is_empty() {
                return None;
            }

            Some((list_id, path))
        })
        .collect()
}

fn run_load_layout(
    euroscope_config_dir: &str,
    profile_name: &str,
) -> Result<Vec<ListConfig>, String> {
    // Convert profile name to snake_case to match saved format
    let profile_name_snake = to_snake_case(profile_name);

    // Build path to custom-profiles Lists.txt
    let appdata = env::var("APPDATA")
        .map_err(|error| format!("unable to get APPDATA environment variable: {}", error))?;

    let lists_txt_path = PathBuf::from(&appdata)
        .join("controller-pack-manager")
        .join("custom-profiles")
        .join(&profile_name_snake)
        .join("Lists.txt");

    if lists_txt_path.exists() {
        let content = fs::read_to_string(&lists_txt_path).map_err(|error| {
            format!(
                "unable to read Lists.txt for profile '{}': {}",
                profile_name, error
            )
        })?;

        let list_configs = parse_list_configs_from_content(&content);
        if !list_configs.is_empty() {
            return Ok(list_configs);
        }
    }

    let profile_filename = if profile_name.ends_with(".prf") {
        profile_name.to_string()
    } else {
        format!("{}.prf", profile_name)
    };
    let profile_path = Path::new(euroscope_config_dir).join(profile_filename);
    let profile_content = fs::read_to_string(&profile_path).map_err(|error| {
        format!(
            "unable to read profile file '{}' for layout recovery: {}",
            profile_path.display(),
            error
        )
    })?;

    let settings_refs = parse_profile_settings_refs(&profile_content);
    if settings_refs.is_empty() {
        return Err(format!(
            "no list configurations found in saved layout for profile '{}'",
            profile_name
        ));
    }

    let mut parsed_by_id: HashMap<String, ListConfig> = HashMap::new();
    let mut visited_paths: HashSet<PathBuf> = HashSet::new();

    for (_, settings_path) in &settings_refs {
        let resolved_path = resolve_settings_reference_path(euroscope_config_dir, settings_path);
        if !visited_paths.insert(resolved_path.clone()) {
            continue;
        }

        let Ok(content) = fs::read_to_string(&resolved_path) else {
            continue;
        };

        for config in parse_list_configs_from_content(&content) {
            parsed_by_id.entry(config.id.clone()).or_insert(config);
        }
    }

    let mut recovered_configs: Vec<ListConfig> = Vec::new();
    let mut used_ids: HashSet<String> = HashSet::new();
    for (list_id, _) in settings_refs {
        if !used_ids.insert(list_id.clone()) {
            continue;
        }

        if let Some(config) = parsed_by_id.remove(&list_id) {
            recovered_configs.push(config);
        }
    }

    if recovered_configs.is_empty() {
        return Err(format!(
            "no list configurations found in saved layout for profile '{}'",
            profile_name
        ));
    }

    Ok(recovered_configs)
}

#[tauri::command]
pub async fn save_screen_config(
    profile_name: String,
    screen_config: ScreenConfig,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        run_save_screen_config(&euroscope_config_dir, &profile_name, screen_config)
    })
    .await
    .map_err(|error| format!("save screen config task failed: {}", error))?
}

fn run_save_screen_config(
    euroscope_config_dir: &str,
    profile_name: &str,
    mut screen_config: ScreenConfig,
) -> Result<String, String> {
    // Convert profile name to snake_case for file paths
    let profile_name_snake = to_snake_case(profile_name);

    // Step 1: Create custom-profiles directory structure
    let appdata = env::var("APPDATA")
        .map_err(|error| format!("unable to get APPDATA environment variable: {}", error))?;

    let custom_profiles_dir = PathBuf::from(&appdata)
        .join("controller-pack-manager")
        .join("generated")
        .join(&profile_name_snake);

    fs::create_dir_all(&custom_profiles_dir)
        .map_err(|error| format!("unable to create custom profiles directory: {}", error))?;

    // Step 2: Create ScreenSettings.txt with serialized configuration
    let screen_settings_txt_path = custom_profiles_dir.join("ScreenSettings.txt");

    // Load existing ScreenSettings content to preserve untouched keys.
    // Priority: currently referenced profile file -> generated fallback.
    let profile_filename = if profile_name.ends_with(".prf") {
        profile_name.to_string()
    } else {
        format!("{}.prf", profile_name)
    };

    let mut loaded_source_from_profile = false;
    let profile_path = Path::new(euroscope_config_dir).join(&profile_filename);
    if let Ok(profile_content) = fs::read_to_string(&profile_path) {
        for line in profile_content.lines() {
            let line_lower = line.to_ascii_lowercase();
            if line.trim().starts_with("Settings")
                && (line_lower.contains("screensettings")
                    || line_lower.contains("settingsfilescreen"))
            {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let settings_path = parts[2..].join(" ");
                    let resolved_path =
                        resolve_settings_reference_path(euroscope_config_dir, &settings_path);
                    if resolved_path.exists() {
                        if let Ok(existing_content) = fs::read_to_string(&resolved_path) {
                            screen_config.source = existing_content;
                            loaded_source_from_profile = true;
                        }
                    }
                }
                break;
            }
        }
    }

    if !loaded_source_from_profile && screen_settings_txt_path.exists() {
        if let Ok(existing_content) = fs::read_to_string(&screen_settings_txt_path) {
            screen_config.source = existing_content;
        }
    }

    let screen_settings_content = format!("{}", screen_config);

    fs::write(&screen_settings_txt_path, screen_settings_content)
        .map_err(|error| format!("unable to write ScreenSettings.txt: {}", error))?;

    // Step 3: Copy to EuroScope directory
    let euroscope_generated_dir = PathBuf::from(euroscope_config_dir)
        .join("LIXX")
        .join("Settings")
        .join("generated")
        .join(&profile_name_snake);

    fs::create_dir_all(&euroscope_generated_dir)
        .map_err(|error| format!("unable to create euroscope generated directory: {}", error))?;

    let euroscope_screen_settings_txt_path = euroscope_generated_dir.join("ScreenSettings.txt");
    fs::copy(
        &screen_settings_txt_path,
        &euroscope_screen_settings_txt_path,
    )
    .map_err(|error| {
        format!(
            "unable to copy ScreenSettings.txt to euroscope directory: {}",
            error
        )
    })?;

    // Step 4: Patch the profile file with ScreenSettings entry
    let mut profile_path = PathBuf::from(euroscope_config_dir);

    // Add .prf extension if not already present
    let profile_filename = if profile_name.ends_with(".prf") {
        profile_name.to_string()
    } else {
        format!("{}.prf", profile_name)
    };

    profile_path.push(&profile_filename);

    // Build the settings path for the profile (relative EuroScope path with snake_case)
    let settings_path = format!(
        "\\LIXX\\Settings\\generated\\{}\\ScreenSettings.txt",
        profile_name_snake
    );

    // Patch profile file to reference the screen settings
    patch_profile_screen_settings_line(&profile_path, &settings_path)?;

    Ok(format!(
        "Screen settings saved successfully for profile '{}'",
        profile_name
    ))
}

#[tauri::command]
pub async fn load_screen_config(
    profile_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<ScreenConfig, String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        run_load_screen_config(&euroscope_config_dir, &profile_name)
    })
    .await
    .map_err(|error| format!("load screen config task failed: {}", error))?
}

fn run_load_screen_config(
    euroscope_config_dir: &str,
    profile_name: &str,
) -> Result<ScreenConfig, String> {
    // Convert profile name to snake_case to match saved format
    let profile_name_snake = to_snake_case(profile_name);

    // Build path to generated ScreenSettings.txt
    let appdata = env::var("APPDATA")
        .map_err(|error| format!("unable to get APPDATA environment variable: {}", error))?;

    let screen_settings_txt_path = PathBuf::from(&appdata)
        .join("controller-pack-manager")
        .join("generated")
        .join(&profile_name_snake)
        .join("ScreenSettings.txt");

    if screen_settings_txt_path.exists() {
        let content = fs::read_to_string(&screen_settings_txt_path).map_err(|error| {
            format!(
                "unable to read ScreenSettings.txt for profile '{}': {}",
                profile_name, error
            )
        })?;

        return ScreenConfig::parse(&content).map_err(|error| {
            format!(
                "unable to parse ScreenSettings.txt for profile '{}': {}",
                profile_name, error
            )
        });
    }

    // Try to load from profile settings reference
    let profile_filename = if profile_name.ends_with(".prf") {
        profile_name.to_string()
    } else {
        format!("{}.prf", profile_name)
    };
    let profile_path = Path::new(euroscope_config_dir).join(&profile_filename);
    let profile_content = fs::read_to_string(&profile_path).map_err(|error| {
        format!(
            "unable to read profile file '{}': {}",
            profile_path.display(),
            error
        )
    })?;

    // Look for screen settings reference in profile
    for line in profile_content.lines() {
        let line_lower = line.to_ascii_lowercase();
        if line.trim().starts_with("Settings")
            && (line_lower.contains("screensettings") || line_lower.contains("settingsfilescreen"))
        {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let settings_path = parts[2..].join(" ");
                let resolved_path =
                    resolve_settings_reference_path(euroscope_config_dir, &settings_path);
                if resolved_path.exists() {
                    let content = fs::read_to_string(&resolved_path).map_err(|error| {
                        format!("unable to read screen settings file: {}", error)
                    })?;
                    return ScreenConfig::parse(&content)
                        .map_err(|error| format!("unable to parse screen settings: {}", error));
                }
            }
        }
    }

    // Return default if no saved config found
    Ok(ScreenConfig::default())
}

#[tauri::command]
pub async fn load_boolean_list_configs(
    profile_name: String,
    state: tauri::State<'_, AppState>,
) -> Result<(Option<ControllerListConfig>, Option<TitleBarConfig>), String> {
    let euroscope_config_dir = state
        .euroscope_config_dir
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "unable to detect euroscope config folder".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        run_load_boolean_list_configs(&euroscope_config_dir, &profile_name)
    })
    .await
    .map_err(|error| format!("load boolean list configs task failed: {}", error))?
}

fn run_load_boolean_list_configs(
    euroscope_config_dir: &str,
    profile_name: &str,
) -> Result<(Option<ControllerListConfig>, Option<TitleBarConfig>), String> {
    // Convert profile name to snake_case to match saved format
    let profile_name_snake = to_snake_case(profile_name);

    // Build path to generated ScreenSettings.txt
    let appdata = env::var("APPDATA")
        .map_err(|error| format!("unable to get APPDATA environment variable: {}", error))?;

    let screen_settings_txt_path = PathBuf::from(&appdata)
        .join("controller-pack-manager")
        .join("generated")
        .join(&profile_name_snake)
        .join("ScreenSettings.txt");

    let mut controller_list = None;
    let mut title_bar = None;

    if screen_settings_txt_path.exists() {
        let content = fs::read_to_string(&screen_settings_txt_path).map_err(|error| {
            format!(
                "unable to read ScreenSettings.txt for profile '{}': {}",
                profile_name, error
            )
        })?;

        // Try to parse both configs
        if let Ok(cfg) = ControllerListConfig::parse(&content) {
            controller_list = Some(cfg);
        }
        if let Ok(cfg) = TitleBarConfig::parse(&content) {
            title_bar = Some(cfg);
        }
    } else {
        // Try to load from profile settings reference
        let profile_filename = if profile_name.ends_with(".prf") {
            profile_name.to_string()
        } else {
            format!("{}.prf", profile_name)
        };
        let profile_path = Path::new(euroscope_config_dir).join(&profile_filename);
        if let Ok(profile_content) = fs::read_to_string(&profile_path) {
            for line in profile_content.lines() {
                let line_lower = line.to_ascii_lowercase();
                if line.trim().starts_with("Settings")
                    && (line_lower.contains("screensettings")
                        || line_lower.contains("settingsfilescreen"))
                {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let settings_path = parts[2..].join(" ");
                        let resolved_path =
                            resolve_settings_reference_path(euroscope_config_dir, &settings_path);
                        if resolved_path.exists() {
                            if let Ok(content) = fs::read_to_string(&resolved_path) {
                                if let Ok(cfg) = ControllerListConfig::parse(&content) {
                                    controller_list = Some(cfg);
                                }
                                if let Ok(cfg) = TitleBarConfig::parse(&content) {
                                    title_bar = Some(cfg);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok((controller_list, title_bar))
}
