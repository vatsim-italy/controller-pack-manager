use crate::profile::Profile;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
}

#[derive(Debug, Serialize)]
struct ControllerPackManagerConfig {
    installed_airac_version: String,
}

#[derive(Debug)]
pub struct AppState {
    pub euroscope_config_dir: Mutex<Option<String>>,
    pub installed_airac_version: Mutex<Option<String>>,
    pub new_airac_version_available: Mutex<Option<bool>>,
    pub profiles: Mutex<Option<Vec<Profile>>>,
    pub hoppie_code: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        let detected_euroscope_config_dir = Self::detect_euroscope_config_folder();
        let detected_installed_airac_version = detected_euroscope_config_dir
            .as_deref()
            .and_then(Self::detect_installed_airac_version);

        let profiles = detected_euroscope_config_dir
            .as_deref()
            .and_then(Self::parse_existing_profiles);

        let hoppie_code = detected_euroscope_config_dir
            .as_deref()
            .and_then(Self::parse_hoppie_code);

        Self::create_config_file_if_missing(detected_installed_airac_version.as_deref());

        let new_airac_version_available = detected_installed_airac_version
            .as_deref()
            .and_then(Self::check_new_airac_version_available);

        Self {
            euroscope_config_dir: Mutex::new(detected_euroscope_config_dir),
            installed_airac_version: Mutex::new(detected_installed_airac_version),
            new_airac_version_available: Mutex::new(new_airac_version_available),
            profiles: Mutex::new(profiles),
            hoppie_code: Mutex::new(hoppie_code),
        }
    }

    fn create_config_file_if_missing(installed_airac_version: Option<&str>) {
        let Some(installed_airac_version) = installed_airac_version else {
            return;
        };

        let Ok(app_data) = env::var("APPDATA") else {
            return;
        };

        let config_dir = PathBuf::from(app_data).join("controller-pack-manager");
        let config_file = config_dir.join("config.json");

        if config_file.exists() {
            return;
        }

        if fs::create_dir_all(&config_dir).is_err() {
            return;
        }

        let config = ControllerPackManagerConfig {
            installed_airac_version: installed_airac_version.to_string(),
        };

        let Ok(serialized_config) = serde_json::to_string_pretty(&config) else {
            return;
        };

        let _ = fs::write(config_file, serialized_config);
    }

    fn detect_euroscope_config_folder() -> Option<String> {
        let mut candidate_dirs: Vec<PathBuf> = Vec::new();

        if let Ok(app_data) = env::var("APPDATA") {
            candidate_dirs.push(PathBuf::from(app_data).join("EuroScope"));
        }

        if let Ok(user_profile) = env::var("USERPROFILE") {
            candidate_dirs.push(
                PathBuf::from(user_profile)
                    .join("AppData")
                    .join("Roaming")
                    .join("EuroScope"),
            );
        }

        candidate_dirs
            .into_iter()
            .find(|candidate| candidate.is_dir())
            .map(|path| path.to_string_lossy().to_string())
    }

    fn detect_installed_airac_version(euroscope_config_dir: &str) -> Option<String> {
        let airac_version_file = PathBuf::from(euroscope_config_dir)
            .join("LIXX")
            .join("AIRAC_VERSION.txt");

        let file_content = std::fs::read_to_string(airac_version_file).ok()?;

        file_content
            .split(' ')
            .skip(1)
            .next()
            .map(|version| version.trim().to_string())
    }

    fn parse_version_components(input: &str) -> Option<Vec<u32>> {
        let components: Vec<u32> = input
            .split(|character: char| !character.is_ascii_digit())
            .filter(|token| !token.is_empty())
            .map(str::parse::<u32>)
            .collect::<Result<Vec<_>, _>>()
            .ok()?;

        if components.is_empty() {
            return None;
        }

        Some(components)
    }

    fn is_latest_newer(current_version: &str, latest_version: &str) -> Option<bool> {
        let current_components = Self::parse_version_components(current_version)?;
        let latest_components = Self::parse_version_components(latest_version)?;

        let max_len = current_components.len().max(latest_components.len());

        for index in 0..max_len {
            let current = *current_components.get(index).unwrap_or(&0);
            let latest = *latest_components.get(index).unwrap_or(&0);

            if latest > current {
                return Some(true);
            }

            if latest < current {
                return Some(false);
            }
        }

        Some(false)
    }

    fn check_new_airac_version_available(current_version: &str) -> Option<bool> {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .ok()?;

        let release = client
            .get("https://api.github.com/repos/vatsim-italy/VATITA-GNG-Files/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "controller-pack-manager")
            .send()
            .ok()?
            .error_for_status()
            .ok()?
            .json::<GitHubRelease>()
            .ok()?;

        Self::is_latest_newer(current_version, &release.tag_name)
    }

    fn parse_existing_profiles(euroscope_config_dir: &str) -> Option<Vec<Profile>> {
        let directory = fs::read_dir(euroscope_config_dir).ok()?;
        let existing_profiles: Vec<String> = directory
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();

                if path.is_file() && path.extension()? == "prf" {
                    Some(path.file_name().unwrap().to_string_lossy().into_owned())
                } else {
                    None
                }
            })
            .collect();

        Some(
            existing_profiles
                .iter()
                .map(|profile_path| {
                    let profile_content = std::fs::read_to_string(
                        PathBuf::from(euroscope_config_dir).join(profile_path),
                    )
                    .expect("we checked before that this file exists");
                    Profile::parse(profile_path, profile_content)
                })
                .collect(),
        )
    }

    fn parse_hoppie_code(euroscope_config_dir: &str) -> Option<String> {
        let file_path = PathBuf::from(euroscope_config_dir)
            .join("LIXX")
            .join("Plugins")
            .join("Topsky")
            .join("TopSkyCPDLCHoppieCode.txt");

        fs::read_to_string(file_path).ok()
    }
}
