use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::app::AppState;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub real_name: Option<String>,
    pub certificate: Option<String>,
    pub server: Option<String>,
    pub connect_to_vatsim: Option<bool>,
    pub proxy_server: Option<String>,
}

impl Profile {
    pub fn parse(file_name: &str, content: String) -> Self {
        let mut profile = Profile {
            name: file_name.to_string(),
            ..Default::default()
        };

        for line in content.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();

            if parts.len() < 2 || parts[0] != "LastSession" {
                continue;
            }

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

        profile
    }
}

pub fn profile_patch_lines(profile: &Profile) -> Vec<String> {
    let mut lines = Vec::new();

    if let Some(value) = &profile.real_name {
        lines.push(format!("LastSession realname {}", value));
    }

    if let Some(value) = &profile.certificate {
        lines.push(format!("LastSession certificate {}", value));
    }

    if let Some(value) = &profile.server {
        lines.push(format!("LastSession server {}", value));
    }

    if let Some(value) = profile.connect_to_vatsim {
        lines.push(format!("LastSession tovatsim {}", value as u8));
    }

    if let Some(value) = &profile.proxy_server {
        lines.push(format!("LastSession proxyserver {}", value));
    }

    lines
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

pub fn update_profile_and_reload(
    euroscope_config_dir: &str,
    original_name: String,
    new_name: String,
    real_name: Option<String>,
    certificate: Option<String>,
    server: Option<String>,
    connect_to_vatsim: Option<bool>,
    proxy_server: Option<String>,
    clone_from: Option<String>,
) -> Result<Vec<Profile>, String> {
    let profile_to_update = Profile {
        name: new_name.clone(),
        real_name,
        certificate,
        server,
        connect_to_vatsim,
        proxy_server,
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

    // Reload all profiles from disk
    AppState::parse_existing_profiles(euroscope_config_dir)
        .ok_or_else(|| "failed to reload profiles".to_string())
}
