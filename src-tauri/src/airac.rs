use crate::profile::{patch_profile_file, Profile};
use crate::topsky::patch_hoppie_code;
use crate::utils::{clear_directory, copy_dir_all, should_skip_release_entry};
use serde::Deserialize;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const LATEST_RELEASE_API_URL: &str =
    "https://api.github.com/repos/vatsim-italy/VATITA-GNG-Files/releases/latest";

#[derive(Debug, Deserialize)]
struct GitHubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    zipball_url: String,
    assets: Vec<GitHubReleaseAsset>,
    body: String,
}

fn fetch_latest_release() -> Result<GitHubRelease, String> {
    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))?;

    client
        .get(LATEST_RELEASE_API_URL)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "controller-pack-manager")
        .send()
        .map_err(|error| format!("unable to fetch latest release: {}", error))?
        .error_for_status()
        .map_err(|error| format!("latest release request failed: {}", error))?
        .json::<GitHubRelease>()
        .map_err(|error| format!("unable to parse latest release payload: {}", error))
}

fn download_and_extract_latest_release(download_folder: &Path) -> Result<String, String> {
    clear_directory(download_folder)?;

    let release = fetch_latest_release()?;

    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))?;

    let download_url = release
        .assets
        .iter()
        .find(|asset| asset.name.to_ascii_lowercase().ends_with(".zip"))
        .map(|asset| asset.browser_download_url.clone())
        .unwrap_or_else(|| release.zipball_url.clone());

    let changelog = release.body.clone();

    let zip_bytes = client
        .get(&download_url)
        .header("User-Agent", "controller-pack-manager")
        .send()
        .map_err(|error| format!("unable to download release asset: {}", error))?
        .error_for_status()
        .map_err(|error| format!("release asset request failed: {}", error))?
        .bytes()
        .map_err(|error| format!("unable to read release zip content: {}", error))?;

    let reader = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|error| format!("unable to open downloaded zip archive: {}", error))?;

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("unable to read zip entry: {}", error))?;

        let Some(enclosed_name) = file.enclosed_name().map(|name| name.to_path_buf()) else {
            continue;
        };

        let output_path = download_folder.join(enclosed_name);

        if file.is_dir() {
            fs::create_dir_all(&output_path).map_err(|error| {
                format!(
                    "unable to create extracted directory '{}': {}",
                    output_path.display(),
                    error
                )
            })?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "unable to create extracted directory '{}': {}",
                    parent.display(),
                    error
                )
            })?;
        }

        let mut output_file = fs::File::create(&output_path).map_err(|error| {
            format!(
                "unable to create extracted file '{}': {}",
                output_path.display(),
                error
            )
        })?;

        io::copy(&mut file, &mut output_file).map_err(|error| {
            format!(
                "unable to extract file '{}': {}",
                output_path.display(),
                error
            )
        })?;
    }

    Ok(changelog)
}

pub fn run_get_latest_airac_changelog() -> Result<String, String> {
    let release = fetch_latest_release()?;
    Ok(release.body)
}

fn directory_contains_airac_content(path: &Path) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };

    entries.filter_map(|entry| entry.ok()).any(|entry| {
        let candidate_path = entry.path();
        (candidate_path.is_file() && extension_is(&candidate_path, "prf"))
            || (candidate_path.is_dir() && entry.file_name().to_string_lossy() == "LIXX")
    })
}

fn find_airac_content_root(path: &Path) -> Option<PathBuf> {
    if directory_contains_airac_content(path) {
        return Some(path.to_path_buf());
    }

    let entries = fs::read_dir(path).ok()?;
    for entry in entries.filter_map(|entry| entry.ok()) {
        let candidate_path = entry.path();
        if candidate_path.is_dir() {
            if let Some(found) = find_airac_content_root(&candidate_path) {
                return Some(found);
            }
        }
    }

    None
}

fn remove_existing_sector_files(target_dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(target_dir)
        .map_err(|error| format!("unable to read euroscope config directory: {}", error))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_path = entry.path();

        if file_path.is_file()
            && (extension_is(&file_path, "ese")
                || extension_is(&file_path, "sct")
                || extension_is(&file_path, "rwy"))
        {
            fs::remove_file(&file_path).map_err(|error| {
                format!(
                    "unable to remove existing file '{}': {}",
                    file_path.display(),
                    error
                )
            })?;
        }
    }

    Ok(())
}

pub fn copy_release_content(
    content_root: &Path,
    euroscope_config_path: &Path,
    destination_lixx: &Path,
) -> Result<(), String> {
    fs::create_dir_all(destination_lixx).map_err(|error| {
        format!(
            "unable to create LIXX directory '{}': {}",
            destination_lixx.display(),
            error
        )
    })?;

    for entry in fs::read_dir(content_root)
        .map_err(|error| format!("unable to read downloaded folder: {}", error))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy().to_string();

        if should_skip_release_entry(&file_name_str) {
            continue;
        }

        if source_path.is_file() {
            let destination = if extension_is(&source_path, "prf") {
                euroscope_config_path.join(&file_name)
            } else {
                destination_lixx.join(&file_name)
            };

            fs::copy(&source_path, &destination).map_err(|error| {
                format!(
                    "unable to copy '{}' to '{}': {}",
                    source_path.display(),
                    destination.display(),
                    error
                )
            })?;
            continue;
        }

        if source_path.is_dir() {
            if file_name.to_string_lossy() == "LIXX" {
                copy_dir_all(&source_path, destination_lixx)?;
            } else {
                copy_dir_all(&source_path, &destination_lixx.join(file_name))?;
            }
        }
    }

    Ok(())
}

fn extension_is(path: &Path, extension: &str) -> bool {
    path.extension()
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

pub fn run_update_airac_version(
    euroscope_config_dir: String,
    existing_profiles: Vec<Profile>,
    hoppie_code: String,
) -> Result<String, String> {
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;
    let download_folder = PathBuf::from(app_data)
        .join("controller-pack-manager")
        .join("download");

    let changelog = download_and_extract_latest_release(&download_folder)?;
    let content_root = find_airac_content_root(&download_folder)
        .ok_or_else(|| "downloaded release does not contain AIRAC content".to_string())?;

    let euroscope_config_path = PathBuf::from(euroscope_config_dir);
    remove_existing_sector_files(&euroscope_config_path)?;

    let downloaded_profile_names: Vec<String> = fs::read_dir(&content_root)
        .map_err(|error| format!("unable to read downloaded folder: {}", error))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();

            if path.is_file() && extension_is(&path, "prf") {
                Some(path.file_name()?.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();

    for profile in &existing_profiles {
        if downloaded_profile_names.contains(&profile.name) {
            let profile_file_path = content_root.join(&profile.name);
            if profile_file_path.is_file() {
                patch_profile_file(&profile_file_path, profile)?;
            }
        }
    }

    let destination_lixx = euroscope_config_path.join("LIXX");
    copy_release_content(&content_root, &euroscope_config_path, &destination_lixx)?;
    patch_hoppie_code(&euroscope_config_path, &hoppie_code)?;

    fs::remove_dir_all(&download_folder).map_err(|error| {
        format!(
            "unable to remove download folder '{}': {}",
            download_folder.display(),
            error
        )
    })?;

    Ok(changelog)
}
