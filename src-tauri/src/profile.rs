use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use crate::app::AppState;
use crate::settings::ScreenConfig;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub real_name: Option<String>,
    pub certificate: Option<String>,
    pub server: Option<String>,
    pub connect_to_vatsim: Option<bool>,
    pub proxy_server: Option<String>,
    pub configured_lists: Vec<(String, String)>,
    pub screen_config: Option<ScreenConfig>,
}

impl Profile {
    pub fn parse(file_name: &str, content: String) -> Self {
        let mut profile = Profile {
            name: file_name.to_string(),
            ..Default::default()
        };

        for line in content.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();

            if parts.len() < 2 {
                continue;
            }

            if parts[0] == "LastSession" {
                Self::parse_last_session_info(&mut profile, &parts);
            } else if parts[0] == "Settings" {
                if let Err(error) = Self::parse_settings_info(&mut profile, &parts) {
                    dbg!(
                        "warning: failed to parse Settings line in profile '{}': {}",
                        file_name,
                        error
                    );
                }
            }
        }

        profile
    }

    pub fn parse_last_session_info(profile: &mut Profile, parts: &Vec<&str>) {
        let key = parts[1];
        let value = parts[2..].join(" ");

        match key {
            "realname" => profile.real_name = Some(value),
            "certificate" => profile.certificate = Some(value),
            "server" => profile.server = Some(value),
            "proxyserver" => profile.proxy_server = Some(value),
            "tovatsim" => {
                profile.connect_to_vatsim = Some(value == "1");
            }
            _ => {}
        }
    }

    pub fn parse_settings_info(profile: &mut Profile, parts: &Vec<&str>) -> Result<(), String> {
        if parts.len() < 3 {
            return Ok(());
        }

        let list_id = parts[1]
            .strip_prefix("Settingsfile")
            .ok_or("failed to parse Settings statement in profile".to_string())?;

        let config_file_path = parts[2..].join(" ");

        profile
            .configured_lists
            .push((list_id.to_string(), config_file_path));

        Ok(())
    }
}

pub fn profile_patch_lines(profile: &Profile) -> Vec<String> {
    let mut lines = Vec::new();

    if let Some(value) = &profile.real_name {
        lines.push(format!("LastSession\trealname\t{}", value));
    }

    if let Some(value) = &profile.certificate {
        lines.push(format!("LastSession\tcertificate\t{}", value));
    }

    if let Some(value) = &profile.server {
        lines.push(format!("LastSession\tserver\t{}", value));
    }

    if let Some(value) = profile.connect_to_vatsim {
        lines.push(format!("LastSession\ttovatsim\t{}", value as u8));
    }

    if let Some(value) = &profile.proxy_server {
        lines.push(format!("LastSession\tproxyserver\t{}", value));
    }

    lines
}

pub fn patch_profile_settings_lines(
    profile_file_path: &Path,
    list_ids: Vec<String>,
    settings_path: &str,
) -> Result<(), String> {
    let content = fs::read_to_string(profile_file_path).map_err(|error| {
        format!(
            "unable to read profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })?;

    // Filter out Settings lines for the list IDs we're updating
    let mut kept_lines: Vec<String> = content
        .lines()
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            if lower.starts_with("settings\tsettingsfile") {
                // Extract the list ID from the line
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    if let Some(id_part) = parts[1].strip_prefix("Settingsfile") {
                        // Check if this list ID is in our list_ids
                        return !list_ids.iter().any(|lid| lid == id_part);
                    }
                }
            }
            true
        })
        .map(|line| line.to_string())
        .collect();

    // Add new Settings lines for each list ID
    for list_id in &list_ids {
        kept_lines.push(format!(
            "Settings\tSettingsfile{}\t{}",
            list_id, settings_path
        ));
    }

    let mut patched = kept_lines.join("\n");

    if !patched.is_empty() {
        patched.push('\n');
    }

    fs::write(profile_file_path, patched).map_err(|error| {
        format!(
            "unable to write patched profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })
}

pub fn patch_profile_file(profile_file_path: &Path, profile: &Profile) -> Result<(), String> {
    let content = fs::read_to_string(profile_file_path).map_err(|error| {
        format!(
            "unable to read profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })?;

    let mut kept_lines: Vec<String> = content
        .lines()
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            !(lower.starts_with("lastsession realname ")
                || lower.starts_with("lastsession certificate ")
                || lower.starts_with("lastsession server ")
                || lower.starts_with("lastsession tovatsim ")
                || lower.starts_with("lastsession proxyserver "))
        })
        .map(|line| line.to_string())
        .collect();

    kept_lines.extend(profile_patch_lines(profile));
    let mut patched = kept_lines.join("\n");

    if !patched.is_empty() {
        patched.push('\n');
    }

    fs::write(profile_file_path, patched).map_err(|error| {
        format!(
            "unable to write patched profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })
}

pub fn patch_profile_screen_settings_line(
    profile_file_path: &Path,
    settings_path: &str,
) -> Result<(), String> {
    let content = fs::read_to_string(profile_file_path).map_err(|error| {
        format!(
            "unable to read profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })?;

    // Filter out existing ScreenSettings lines
    let mut kept_lines: Vec<String> = content
        .lines()
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            !(lower.contains("settingsfilescreen") || lower.contains("screensettings"))
        })
        .map(|line| line.to_string())
        .collect();

    // Add new Settings line for screen settings
    kept_lines.push(format!("Settings\tSettingsfileScreen\t{}", settings_path));

    let mut patched = kept_lines.join("\n");

    if !patched.is_empty() {
        patched.push('\n');
    }

    fs::write(profile_file_path, patched).map_err(|error| {
        format!(
            "unable to write patched profile '{}': {}",
            profile_file_path.display(),
            error
        )
    })
}

pub fn update_profile_and_reload(
    euroscope_config_dir: &str,
    original_name: String,
    new_name: String,
    real_name: Option<String>,
    certificate: Option<String>,
    server: Option<String>,
    connect_to_vatsim: Option<bool>,
    proxy_server: Option<String>,
    configured_lists: Vec<(String, String)>,
    clone_from: Option<String>,
) -> Result<Vec<Profile>, String> {
    let profile_to_update = Profile {
        name: new_name.clone(),
        real_name,
        certificate,
        server,
        connect_to_vatsim,
        proxy_server,
        configured_lists,
        screen_config: None,
    };

    // Build the path to the original profile file
    let original_path = PathBuf::from(euroscope_config_dir).join(&original_name);
    let new_path = PathBuf::from(euroscope_config_dir).join(&new_name);

    // Check if this is a new profile (file doesn't exist)
    if !original_path.exists() {
        // If cloning from another profile, copy its entire content first
        let base_content = if let Some(source_name) = clone_from {
            let source_path = PathBuf::from(euroscope_config_dir).join(&source_name);
            fs::read_to_string(&source_path).map_err(|error| {
                format!(
                    "unable to read source profile '{}': {}",
                    source_path.display(),
                    error
                )
            })?
        } else {
            String::new()
        };

        // Parse existing lines and filter out the fields we're updating
        let mut kept_lines: Vec<String> = base_content
            .lines()
            .filter(|line| {
                let lower = line.to_ascii_lowercase();
                !(lower.starts_with("lastsession realname ")
                    || lower.starts_with("lastsession certificate ")
                    || lower.starts_with("lastsession server ")
                    || lower.starts_with("lastsession tovatsim ")
                    || lower.starts_with("lastsession proxyserver "))
            })
            .map(|line| line.to_string())
            .collect();

        // Apply patches with new values
        kept_lines.extend(profile_patch_lines(&profile_to_update));
        let mut patched = kept_lines.join("\n");

        if !patched.is_empty() {
            patched.push('\n');
        }

        fs::write(&new_path, patched).map_err(|error| {
            format!(
                "unable to create profile '{}': {}",
                new_path.display(),
                error
            )
        })?;
    } else {
        // Update existing profile file
        patch_profile_file(&original_path, &profile_to_update)?;

        // If the name changed, rename the file
        if original_name != new_name {
            fs::rename(&original_path, &new_path)
                .map_err(|error| format!("failed to rename profile file: {}", error))?;
        }
    }

    // Reload all profiles from disk
    AppState::parse_existing_profiles(euroscope_config_dir)
        .ok_or_else(|| "failed to reload profiles".to_string())
}

pub fn delete_profile_and_reload(
    euroscope_config_dir: &str,
    profile_name: String,
) -> Result<Vec<Profile>, String> {
    let profile_path = PathBuf::from(euroscope_config_dir).join(&profile_name);

    if !profile_path.exists() {
        return Err(format!(
            "profile '{}' does not exist",
            profile_path.display()
        ));
    }

    fs::remove_file(&profile_path).map_err(|error| {
        format!(
            "unable to delete profile '{}': {}",
            profile_path.display(),
            error
        )
    })?;

    delete_generated_layout_folders(euroscope_config_dir, &profile_name)?;

    // Reload all profiles from disk
    AppState::parse_existing_profiles(euroscope_config_dir)
        .ok_or_else(|| "failed to reload profiles".to_string())
}

fn delete_generated_layout_folders(
    euroscope_config_dir: &str,
    profile_name: &str,
) -> Result<(), String> {
    let profile_base_name = profile_name
        .strip_suffix(".prf")
        .or_else(|| profile_name.strip_suffix(".PRF"))
        .unwrap_or(profile_name);

    let profile_name_snake = profile_base_name
        .replace(|c: char| c.is_whitespace() || !c.is_alphanumeric(), "_")
        .to_lowercase()
        .split('_')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("_");

    let generated_dir = PathBuf::from(euroscope_config_dir)
        .join("LIXX")
        .join("Settings")
        .join("generated")
        .join(&profile_name_snake);

    if generated_dir.exists() {
        fs::remove_dir_all(&generated_dir).map_err(|error| {
            format!(
                "unable to delete generated layout directory '{}': {}",
                generated_dir.display(),
                error
            )
        })?;
    }

    if let Ok(app_data) = env::var("APPDATA") {
        let custom_profile_dir = PathBuf::from(app_data)
            .join("controller-pack-manager")
            .join("custom-profiles")
            .join(&profile_name_snake);

        if custom_profile_dir.exists() {
            fs::remove_dir_all(&custom_profile_dir).map_err(|error| {
                format!(
                    "unable to delete custom profile layout directory '{}': {}",
                    custom_profile_dir.display(),
                    error
                )
            })?;
        }
    }

    Ok(())
}
