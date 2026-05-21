use crate::config::ensure_config_file;
use crate::profile::Profile;
use crate::plugin::reset_cached_plugin_update_info;
use crate::settings::ListConfig;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug)]
pub struct AppState {
    pub euroscope_config_dir: Mutex<Option<String>>,
    pub installed_airac_version: Mutex<Option<String>>,
    pub new_airac_version_available: Mutex<Option<bool>>,
    pub profiles: Mutex<Option<Vec<Profile>>>,
    pub hoppie_code: Mutex<Option<String>>,
    pub list_configs: Mutex<Option<Vec<ListConfig>>>,
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

        let list_configs = detected_euroscope_config_dir
            .as_deref()
            .and_then(Self::parse_list_configs);

        let _ = ensure_config_file(detected_installed_airac_version.as_deref());
        let _ = reset_cached_plugin_update_info();

        Self {
            euroscope_config_dir: Mutex::new(detected_euroscope_config_dir),
            installed_airac_version: Mutex::new(detected_installed_airac_version),
            new_airac_version_available: Mutex::new(None),
            profiles: Mutex::new(profiles),
            hoppie_code: Mutex::new(hoppie_code),
            list_configs: Mutex::new(list_configs),
        }
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

    pub(crate) fn is_latest_newer(current_version: &str, latest_version: &str) -> Option<bool> {
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

    pub fn parse_existing_profiles(euroscope_config_dir: &str) -> Option<Vec<Profile>> {
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
        let preferred_path = PathBuf::from(euroscope_config_dir)
            .join("Plugins")
            .join("Topsky")
            .join("TopSkyCPDLCHoppieCode.txt");

        if let Ok(code) = fs::read_to_string(&preferred_path) {
            return Some(code);
        }

        let legacy_path = PathBuf::from(euroscope_config_dir)
            .join("LIXX")
            .join("Plugins")
            .join("Topsky")
            .join("TopSkyCPDLCHoppieCode.txt");

        fs::read_to_string(legacy_path).ok()
    }

    fn parse_list_configs(euroscope_config_dir: &str) -> Option<Vec<ListConfig>> {
        let path = PathBuf::from(euroscope_config_dir)
            .join("LIXX")
            .join("Settings");

        let directory = fs::read_dir(path).ok()?;
        let files = directory.filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let filename = path.file_name()?.to_string_lossy();
            let filename_lower = filename.to_ascii_lowercase();

            if path.is_file()
                && (filename_lower.contains("list")
                    || filename.eq_ignore_ascii_case("italyCTR.txt"))
                && path
                    .extension()
                    .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("txt"))
                    .unwrap_or(false)
            {
                Some(path)
            } else {
                None
            }
        });

        Some(
            files
                .filter_map(|file| {
                    if let Ok(content) = fs::read_to_string(file) {
                        if let Ok(config) = ListConfig::parse(content.as_str()) {
                            return Some(config);
                        }
                    }

                    None
                })
                .collect(),
        )
    }
}
