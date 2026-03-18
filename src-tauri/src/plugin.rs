use crate::config::{read_config_or_default, update_config};
use crate::github_http::{
    download_bytes, download_release_asset_bytes, fetch_latest_release, resolve_github_token,
};
use crate::utils::clear_directory;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const LATEST_RELEASE_API_URL: &str =
    "https://api.github.com/repos/vatsim-italy/plugin/releases/latest";
const RELEASES_API_URL: &str =
    "https://api.github.com/repos/vatsim-italy/plugin/releases?per_page=30";
const PLUGIN_FOLDER_NAME: &str = "VATITA Controller Plugin";
const PLUGIN_ASSET_NAME: &str = "VCP.dll";

#[derive(Debug, serde::Deserialize)]
struct PluginRelease {
    #[serde(default)]
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    body: String,
    #[serde(default)]
    assets: Vec<crate::github_http::GitHubReleaseAsset>,
}

fn fetch_releases(token: &str) -> Result<Vec<PluginRelease>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))?;

    client
        .get(RELEASES_API_URL)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "controller-pack-manager")
        .bearer_auth(token)
        .send()
        .map_err(|error| format!("unable to fetch releases list: {}", error))?
        .error_for_status()
        .map_err(|error| format!("releases list request failed: {}", error))?
        .json::<Vec<PluginRelease>>()
        .map_err(|error| format!("unable to parse releases list payload: {}", error))
}

fn find_release_asset(release: &PluginRelease) -> Option<&crate::github_http::GitHubReleaseAsset> {
    release
        .assets
        .iter()
        .find(|asset| asset.name.eq_ignore_ascii_case(PLUGIN_ASSET_NAME))
}

fn select_release(token: &str, dev_releases_opt_in: bool) -> Result<PluginRelease, String> {
    if dev_releases_opt_in {
        let releases = fetch_releases(token)?;
        return releases
            .into_iter()
            .find(|release| {
                (release.draft || release.prerelease) && find_release_asset(release).is_some()
            })
            .ok_or_else(|| {
                format!(
                    "no dev release (draft/prerelease) with asset '{}' was found",
                    PLUGIN_ASSET_NAME
                )
            });
    }

    let stable_release = fetch_latest_release(LATEST_RELEASE_API_URL, Some(token))?;
    let stable_asset = stable_release
        .assets
        .iter()
        .find(|asset| asset.name.eq_ignore_ascii_case(PLUGIN_ASSET_NAME))
        .ok_or_else(|| {
            format!(
                "release does not contain required asset '{}'",
                PLUGIN_ASSET_NAME
            )
        })?;

    Ok(PluginRelease {
        tag_name: stable_release.tag_name,
        draft: false,
        prerelease: false,
        body: stable_release.body,
        assets: vec![crate::github_http::GitHubReleaseAsset {
            url: stable_asset.url.clone(),
            name: PLUGIN_ASSET_NAME.to_string(),
            browser_download_url: stable_asset.browser_download_url.clone(),
        }],
    })
}

pub fn get_plugin_dev_releases_opt_in() -> Result<bool, String> {
    Ok(read_config_or_default()?.plugin_dev_releases_opt_in)
}

pub fn set_plugin_dev_releases_opt_in(opt_in: bool) -> Result<(), String> {
    update_config(|config| {
        config.plugin_dev_releases_opt_in = opt_in;
    })
    .map(|_| ())
}

pub fn get_installed_plugin_version() -> Result<Option<String>, String> {
    Ok(read_config_or_default()?.installed_plugin_version)
}

pub fn get_latest_plugin_installable_version() -> Result<Option<String>, String> {
    let config = read_config_or_default()?;
    if !config.plugin_dev_releases_opt_in {
        return Ok(None);
    }

    let token = require_private_repo_token()?;
    let release = select_release(&token, true)?;

    if release.tag_name.trim().is_empty() {
        return Ok(None);
    }

    let latest_version = release.tag_name.trim().to_string();
    if config
        .installed_plugin_version
        .as_deref()
        .is_some_and(|installed| installed.trim() == latest_version)
    {
        return Ok(None);
    }

    Ok(Some(latest_version))
}

fn require_private_repo_token() -> Result<String, String> {
    resolve_github_token().ok_or_else(|| {
        "missing github access token for private plugin repository. Set VATITA_GITHUB_TOKEN or store one with set_github_access_token".to_string()
    })
}

fn download_latest_plugin_asset(
    download_folder: &Path,
    release: &PluginRelease,
    token: &str,
) -> Result<PathBuf, String> {
    clear_directory(download_folder)?;

    let dll_asset = find_release_asset(release).ok_or_else(|| {
        format!(
            "release does not contain required asset '{}'",
            PLUGIN_ASSET_NAME
        )
    })?;

    let dll_bytes = if !dll_asset.url.trim().is_empty() {
        download_release_asset_bytes(&dll_asset.url, Some(token)).or_else(|_| {
            if dll_asset.browser_download_url.trim().is_empty() {
                Err(format!(
                    "release does not provide a valid download url for '{}'",
                    PLUGIN_ASSET_NAME
                ))
            } else {
                download_bytes(&dll_asset.browser_download_url, Some(token))
            }
        })?
    } else if !dll_asset.browser_download_url.trim().is_empty() {
        download_bytes(&dll_asset.browser_download_url, Some(token))?
    } else {
        return Err(format!(
            "release does not provide a valid download url for '{}'",
            PLUGIN_ASSET_NAME
        ));
    };
    let downloaded_dll_path = download_folder.join(PLUGIN_ASSET_NAME);

    fs::write(&downloaded_dll_path, dll_bytes).map_err(|error| {
        format!(
            "unable to write downloaded plugin asset '{}': {}",
            downloaded_dll_path.display(),
            error
        )
    })?;

    Ok(downloaded_dll_path)
}

pub fn run_get_latest_plugin_changelog() -> Result<String, String> {
    let token = require_private_repo_token()?;
    let config = read_config_or_default()?;
    let release = select_release(&token, config.plugin_dev_releases_opt_in)?;
    Ok(release.body)
}

pub fn run_update_plugin_version() -> Result<String, String> {
    let config = read_config_or_default()?;

    let token = require_private_repo_token()?;
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;

    let base_folder = PathBuf::from(&app_data).join("controller-pack-manager");
    let download_folder = base_folder.join("download-plugin");

    let release = select_release(&token, config.plugin_dev_releases_opt_in)?;
    let downloaded_dll_path = download_latest_plugin_asset(&download_folder, &release, &token)?;

    let plugins_root = PathBuf::from(&app_data)
        .join("EuroScope")
        .join("LIXX")
        .join("Plugins");
    let plugin_target_directory = plugins_root.join(PLUGIN_FOLDER_NAME);
    let plugin_target_dll_path = plugin_target_directory.join(PLUGIN_ASSET_NAME);

    fs::create_dir_all(&plugins_root).map_err(|error| {
        format!(
            "unable to create plugins directory '{}': {}",
            plugins_root.display(),
            error
        )
    })?;

    fs::create_dir_all(&plugin_target_directory).map_err(|error| {
        format!(
            "unable to create plugin directory '{}': {}",
            plugin_target_directory.display(),
            error
        )
    })?;

    fs::copy(&downloaded_dll_path, &plugin_target_dll_path).map_err(|error| {
        format!(
            "unable to copy '{}' to '{}': {}",
            downloaded_dll_path.display(),
            plugin_target_dll_path.display(),
            error
        )
    })?;

    fs::remove_dir_all(&download_folder).map_err(|error| {
        format!(
            "unable to remove plugin download folder '{}': {}",
            download_folder.display(),
            error
        )
    })?;

    let installed_version = if release.tag_name.trim().is_empty() {
        None
    } else {
        Some(release.tag_name.clone())
    };

    update_config(|stored_config| {
        stored_config.installed_plugin_version = installed_version.clone();
    })?;

    Ok(release.body)
}
