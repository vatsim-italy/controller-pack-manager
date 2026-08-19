use crate::config::{read_config_or_default, update_config};
use crate::github_http::download_bytes;
use crate::utils::clear_directory;
use sha2::{Sha256, Digest};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const RELEASES_API_URL: &str = "https://www.vatita.net/api/plugin";
const PLUGIN_FOLDER_NAME: &str = "VATITA Controller Plugin";
const PLUGIN_ASSET_NAME: &str = "VCP.dll";

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Artifact {
    pub id: u64,
    pub name: String,
    pub digest: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PluginRelease {
    pub id: u64,
    pub title: String,
    #[serde(default)]
    pub changelog: Option<String>,
    pub artifacts: Vec<Artifact>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PluginVersionHistory {
    pub digest: String,
    pub name: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PluginApiResponse {
    pub dev: Option<PluginRelease>,
    pub latest: PluginRelease,
    pub history: Vec<PluginVersionHistory>,
}

/// Fetches the wrapper object containing both dev and latest releases
fn fetch_releases() -> Result<PluginApiResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))?;

    client
        .get(RELEASES_API_URL)
        .send()
        .map_err(|error| format!("releases list request failed: {}", error))?
        .json::<PluginApiResponse>()
        .map_err(|error| format!("unable to parse releases list payload: {}", error))
}

fn find_release_asset(release: &PluginRelease) -> Option<&Artifact> {
    release
        .artifacts
        .iter()
        .find(|asset| asset.name.eq_ignore_ascii_case(PLUGIN_ASSET_NAME))
}

fn select_release(dev_releases_opt_in: bool) -> Result<PluginRelease, String> {
    let response = fetch_releases()?;

    let release = if dev_releases_opt_in {
        response.dev.ok_or_else(|| "no dev release is currently available".to_string())?
    } else {
        response.latest
    };

    if find_release_asset(&release).is_some() {
        Ok(release)
    } else {
        Err(format!(
            "release '{}' does not contain required asset '{}'",
            release.title, PLUGIN_ASSET_NAME
        ))
    }
}

pub fn get_plugin_releases() -> Result<PluginApiResponse, String> {
    fetch_releases()
}

pub fn get_plugin_dev_releases_opt_in() -> Result<bool, String> {
    Ok(read_config_or_default()?.plugin_dev_releases_opt_in)
}

pub fn set_plugin_dev_releases_opt_in(opt_in: bool) -> Result<(), String> {
    update_config(|config| {
        config.plugin_dev_releases_opt_in = opt_in;
        config.latest_plugin_version = None;
        config.latest_plugin_digest = None;
    })
    .map(|_| ())
}

pub fn reset_cached_plugin_update_info() -> Result<(), String> {
    update_config(|config| {
        config.latest_plugin_version = None;
        config.latest_plugin_digest = None;
    })
    .map(|_| ())
}

fn digests_match(d1: &str, d2: &str) -> bool {
    let clean1 = d1.trim().trim_start_matches("sha256:");
    let clean2 = d2.trim().trim_start_matches("sha256:");
    clean1.eq_ignore_ascii_case(clean2)
}

pub fn get_installed_plugin_version() -> Result<Option<String>, String> {
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;
    let plugin_path = PathBuf::from(&app_data)
        .join("EuroScope/LIXX/Plugins")
        .join(PLUGIN_FOLDER_NAME)
        .join(PLUGIN_ASSET_NAME);

    // 1. Check physical file existence. If missing, clear stale config and return None.
    if !plugin_path.exists() {
        let config = read_config_or_default()?;
        if config.installed_plugin_version.is_some() || config.installed_plugin_digest.is_some() {
            let _ = update_config(|stored_config| {
                stored_config.installed_plugin_version = None;
                stored_config.installed_plugin_digest = None;
            });
        }
        return Ok(None);
    }

    let config = read_config_or_default()?;
    let calculated_digest = calculate_file_sha256(&plugin_path)?;

    println!("[Plugin] Calculated local file digest: {}", calculated_digest);
    println!("[Plugin] Stored config digest: {:?}", config.installed_plugin_digest);
    println!("[Plugin] Stored config version: {:?}", config.installed_plugin_version);

    // 2. Fast Path: Trust saved version ONLY if stored digest matches physical file AND stored version is a resolved version string (not "installed" or "unknown")
    if let (Some(stored_digest), Some(stored_version)) = (
        config.installed_plugin_digest.as_ref(),
        config.installed_plugin_version.as_ref(),
    ) {
        if digests_match(stored_digest, &calculated_digest)
            && stored_version != "installed"
            && stored_version != "unknown"
        {
            println!("[Plugin] Fast-path hit: stored digest matches local file. Version: {}", stored_version);
            return Ok(Some(stored_version.clone()));
        }
    }

    // 3. Fallback / Re-verify Path: Match digest against API history, latest, and dev
    println!("[Plugin] Fetching API releases to match local digest '{}'...", calculated_digest);
    let releases = fetch_releases()?;

    for h in &releases.history {
        let is_match = digests_match(&h.digest, &calculated_digest);
        println!(
            "[Plugin]   Comparing against history: version='{}', digest='{}' -> match={}",
            h.name, h.digest, is_match
        );
    }

    for a in &releases.latest.artifacts {
        if let Some(d) = &a.digest {
            let is_match = digests_match(d, &calculated_digest);
            println!(
                "[Plugin]   Comparing against latest artifact: name='{}', title='{}', digest='{}' -> match={}",
                a.name, releases.latest.title, d, is_match
            );
        }
    }

    if let Some(dev) = releases.dev.as_ref() {
        for a in &dev.artifacts {
            if let Some(d) = &a.digest {
                let is_match = digests_match(d, &calculated_digest);
                println!(
                    "[Plugin]   Comparing against dev artifact: name='{}', title='{}', digest='{}' -> match={}",
                    a.name, dev.title, d, is_match
                );
            }
        }
    }

    let version_name = releases.history.iter()
        .find(|h| digests_match(&h.digest, &calculated_digest))
        .map(|h| h.name.clone())
        .or_else(|| {
            if releases.latest.artifacts.iter().any(|a| a.digest.as_ref().is_some_and(|d| digests_match(d, &calculated_digest))) {
                return Some(releases.latest.title.clone());
            }
            if let Some(dev) = releases.dev.as_ref() {
                if dev.artifacts.iter().any(|a| a.digest.as_ref().is_some_and(|d| digests_match(d, &calculated_digest))) {
                    return Some(dev.title.clone());
                }
            }
            None
        })
        .unwrap_or_else(|| "installed".to_string());

    println!("[Plugin] Final resolved version: '{}' for digest '{}'", version_name, calculated_digest);

    // 4. Update stored config with resolved version and digest
    update_config(|stored_config| {
        stored_config.installed_plugin_version = Some(version_name.clone());
        stored_config.installed_plugin_digest = Some(calculated_digest);
    }).map_err(|e| format!("failed to update config: {}", e))?;

    Ok(Some(version_name))
}


pub fn get_latest_plugin_installable_version() -> Result<Option<String>, String> {
    let config = read_config_or_default()?;
    println!("[Plugin] Checking for available updates...");
    println!("[Plugin] Installed version: {:?}", config.installed_plugin_version);
    println!("[Plugin] Installed digest: {:?}", config.installed_plugin_digest);

    // Fast path: use cached latest digest if available
    if let Some(latest_digest) = config.latest_plugin_digest.as_ref() {
        if let Some(installed_digest) = config.installed_plugin_digest.as_ref() {
            println!("[Plugin] Using cached latest digest");
            if digests_match(installed_digest, latest_digest) {
                println!("[Plugin] Digests match - no update needed");
                return Ok(None);
            }
            println!("[Plugin] Cached digests differ - update available");
            return Ok(config.latest_plugin_version.clone());
        }
    }

    // Slow path: fetch from network and cache
    let release = select_release(config.plugin_dev_releases_opt_in)?;
    if release.title.trim().is_empty() {
        println!("[Plugin] Release title is empty, no update");
        return Ok(None);
    }

    let latest_digest = find_release_asset(&release).and_then(|a| a.digest.clone());
    let latest_version = release.title.trim().to_string();
    
    // Cache the fetched result for next time
    update_config(|stored_config| {
        stored_config.latest_plugin_version = Some(latest_version.clone());
        stored_config.latest_plugin_digest = latest_digest.clone();
    }).map_err(|e| format!("failed to cache plugin info: {}", e))?;
    
    println!("[Plugin] Latest version (fetched): {}", latest_version);
    println!("[Plugin] Latest digest (fetched): {:?}", latest_digest);

    // Compare by digest if available (more reliable)
    if let Some(latest) = latest_digest {
        if let Some(installed) = config.installed_plugin_digest {
            if digests_match(&installed, &latest) {
                println!("[Plugin] Digests match - no update needed");
                return Ok(None); // Same digest, no update needed
            }
            println!("[Plugin] Digests differ - update available");
        } else {
            println!("[Plugin] No installed digest but digest available - update available");
        }
        // Different digest or no stored digest, update available
        return Ok(Some(latest_version));
    }

    // Fallback to version string comparison if digest not available
    println!("[Plugin] Digest not available, falling back to version comparison");
    if config
        .installed_plugin_version
        .as_deref()
        .is_some_and(|installed| installed.trim() == latest_version)
    {
        println!("[Plugin] Versions match - no update needed");
        return Ok(None);
    }

    println!("[Plugin] Update available: {}", latest_version);
    Ok(Some(latest_version))
}

fn calculate_file_sha256(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| format!("unable to read file: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let digest = hasher.finalize();
    Ok(format!("sha256:{:x}", digest))
}

fn find_all_dll_assets(release: &PluginRelease) -> Vec<&Artifact> {
    release
        .artifacts
        .iter()
        .filter(|asset| asset.name.to_lowercase().ends_with(".dll"))
        .collect()
}

fn download_latest_plugin_assets(
    download_folder: &Path,
    release: &PluginRelease,
) -> Result<Vec<PathBuf>, String> {
    clear_directory(download_folder)?;

    let dll_assets = find_all_dll_assets(release);
    if dll_assets.is_empty() {
        return Err(format!(
            "release '{}' does not contain any DLL assets",
            release.title
        ));
    }

    let mut downloaded_paths = Vec::new();
    for asset in dll_assets {
        let download_url = format!("{}/{}/{}", RELEASES_API_URL, release.id, asset.name);
        let dll_bytes = download_bytes(&download_url)?;
        let downloaded_file_path = download_folder.join(&asset.name);

        fs::write(&downloaded_file_path, dll_bytes).map_err(|error| {
            format!(
                "unable to write downloaded plugin asset '{}': {}",
                downloaded_file_path.display(),
                error
            )
        })?;

        downloaded_paths.push(downloaded_file_path);
    }

    Ok(downloaded_paths)
}

pub fn run_get_latest_plugin_changelog() -> Result<String, String> {
    let config = read_config_or_default()?;
    let release = select_release(config.plugin_dev_releases_opt_in)?;
    println!("{:?}", release);
    Ok(release.changelog.unwrap_or_default())
}

pub fn run_update_plugin_version() -> Result<String, String> {
    let config = read_config_or_default()?;
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;

    let base_folder = PathBuf::from(&app_data).join("controller-pack-manager");
    let download_folder = base_folder.join("download-plugin");

    let release = select_release(config.plugin_dev_releases_opt_in)?;
    println!("[Plugin] Downloading version: {}", release.title);
    let downloaded_dll_paths = download_latest_plugin_assets(&download_folder, &release)?;

    let plugins_root = PathBuf::from(&app_data)
        .join("EuroScope")
        .join("LIXX")
        .join("Plugins");
    let plugin_target_directory = plugins_root.join(PLUGIN_FOLDER_NAME);

    println!("[Plugin] Installing to: {}", plugin_target_directory.display());

    fs::create_dir_all(&plugins_root).map_err(|error| {
        format!("unable to create plugins directory '{}': {}", plugins_root.display(), error)
    })?;

    fs::create_dir_all(&plugin_target_directory).map_err(|error| {
        format!("unable to create plugin directory '{}': {}", plugin_target_directory.display(), error)
    })?;

    for downloaded_path in &downloaded_dll_paths {
        if let Some(file_name) = downloaded_path.file_name() {
            let target_path = plugin_target_directory.join(file_name);
            fs::copy(downloaded_path, &target_path).map_err(|error| {
                if error.kind() == std::io::ErrorKind::PermissionDenied {
                    format!(
                        "unable to update plugin asset '{}': EuroScope is currently running or locking the file. Please close EuroScope and try again.",
                        file_name.to_string_lossy()
                    )
                } else {
                    format!(
                        "unable to copy '{}' to '{}': {}",
                        downloaded_path.display(),
                        target_path.display(),
                        error
                    )
                }
            })?;
        }
    }

    let _ = fs::remove_dir_all(&download_folder);

    let installed_version = if release.title.trim().is_empty() {
        None
    } else {
        Some(release.title.clone())
    };

    let installed_digest = find_release_asset(&release).and_then(|a| a.digest.clone());
    println!("[Plugin] Storing version: {:?}, digest: {:?}", installed_version, installed_digest);

    update_config(|stored_config| {
        stored_config.installed_plugin_version = installed_version.clone();
        stored_config.installed_plugin_digest = installed_digest.clone();
        // Invalidate cached latest release info so the next check refreshes from the network.
        stored_config.latest_plugin_version = None;
        stored_config.latest_plugin_digest = None;
    }).map_err(|e| format!("failed to update config: {}", e))?;

    println!("[Plugin] Update completed successfully!");
    Ok(release.title)
}