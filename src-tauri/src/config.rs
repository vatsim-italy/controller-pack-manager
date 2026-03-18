use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ControllerPackManagerConfig {
    #[serde(default)]
    pub installed_airac_version: Option<String>,
    #[serde(default)]
    pub github_access_token: Option<String>,
    #[serde(default)]
    pub plugin_dev_releases_opt_in: bool,
    #[serde(default)]
    pub installed_plugin_version: Option<String>,
}

fn config_dir_path() -> Result<PathBuf, String> {
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;
    Ok(PathBuf::from(app_data).join("controller-pack-manager"))
}

fn config_file_path() -> Result<PathBuf, String> {
    Ok(config_dir_path()?.join("config.json"))
}

pub fn read_config_or_default() -> Result<ControllerPackManagerConfig, String> {
    let file_path = config_file_path()?;

    if !file_path.exists() {
        return Ok(ControllerPackManagerConfig::default());
    }

    let file_content = fs::read_to_string(&file_path).map_err(|error| {
        format!(
            "unable to read config file '{}': {}",
            file_path.display(),
            error
        )
    })?;

    serde_json::from_str::<ControllerPackManagerConfig>(&file_content).map_err(|error| {
        format!(
            "unable to parse config file '{}': {}",
            file_path.display(),
            error
        )
    })
}

pub fn write_config(config: &ControllerPackManagerConfig) -> Result<(), String> {
    let dir_path = config_dir_path()?;
    let file_path = config_file_path()?;

    fs::create_dir_all(&dir_path).map_err(|error| {
        format!(
            "unable to create config directory '{}': {}",
            dir_path.display(),
            error
        )
    })?;

    let serialized = serde_json::to_string_pretty(config)
        .map_err(|error| format!("unable to serialize config payload: {}", error))?;

    fs::write(&file_path, serialized).map_err(|error| {
        format!(
            "unable to write config file '{}': {}",
            file_path.display(),
            error
        )
    })
}

pub fn update_config<F>(updater: F) -> Result<ControllerPackManagerConfig, String>
where
    F: FnOnce(&mut ControllerPackManagerConfig),
{
    let mut config = read_config_or_default()?;
    updater(&mut config);
    write_config(&config)?;
    Ok(config)
}

pub fn ensure_config_file(installed_airac_version: Option<&str>) -> Result<(), String> {
    let mut config = read_config_or_default()?;

    if config.installed_airac_version.is_none() {
        config.installed_airac_version = installed_airac_version.map(|value| value.to_string());
    }

    write_config(&config)
}