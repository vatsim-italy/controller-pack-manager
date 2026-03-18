use crate::github_http::{download_bytes, fetch_latest_release};
use crate::profile::{patch_profile_file, Profile};
use crate::topsky::patch_hoppie_code;
use crate::utils::{clear_directory, copy_dir_all, should_skip_release_entry};
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const LATEST_RELEASE_API_URL: &str =
    "https://api.github.com/repos/vatsim-italy/VATITA-GNG-Files/releases/latest";
const APP_DATA_FOLDER_NAME: &str = "controller-pack-manager";
const IMPORTED_SECTOR_FILES_FOLDER_NAME: &str = "imported-sector-files";

fn app_data_work_dir() -> Result<PathBuf, String> {
    let app_data = env::var("APPDATA").map_err(|_| "unable to find appdata folder".to_string())?;
    Ok(PathBuf::from(app_data).join(APP_DATA_FOLDER_NAME))
}

fn imported_sector_files_dir() -> Result<PathBuf, String> {
    Ok(app_data_work_dir()?.join(IMPORTED_SECTOR_FILES_FOLDER_NAME))
}

fn validate_import_zip_file(zip_file_path: &Path) -> Result<(), String> {
    let mut zip_file = fs::File::open(zip_file_path).map_err(|error| {
        format!(
            "unable to open imported zip '{}': {}",
            zip_file_path.display(),
            error
        )
    })?;

    let mut header = [0_u8; 512];
    let bytes_read = io::Read::read(&mut zip_file, &mut header)
        .map_err(|error| format!("unable to read imported zip header: {}", error))?;

    if bytes_read == 0 {
        return Err(
            "selected file is empty. Please import the downloaded AeroNav zip file.".to_string(),
        );
    }

    let header_slice = &header[..bytes_read];
    let is_zip_magic = header_slice.starts_with(b"PK\x03\x04")
        || header_slice.starts_with(b"PK\x05\x06")
        || header_slice.starts_with(b"PK\x07\x08");

    if is_zip_magic {
        return Ok(());
    }

    let header_text = String::from_utf8_lossy(header_slice).to_ascii_lowercase();
    if header_text.contains("<html") || header_text.contains("<!doctype html") {
        return Err(
            "selected file is an HTML page, not a zip archive. This usually means login/download did not complete in the browser. Log in on AeroNav, download the real zip, then import it again.".to_string(),
        );
    }

    Err("selected file is not a valid zip archive. Import the AeroNav zip that contains .sct and .ese files.".to_string())
}

fn has_required_sector_files(path: &Path) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }

    let mut has_sct = false;
    let mut has_ese = false;

    for entry in fs::read_dir(path)
        .map_err(|error| format!("unable to read sector files folder: {}", error))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();

        if !entry_path.is_file() {
            continue;
        }

        if extension_is(&entry_path, "sct") {
            has_sct = true;
        }

        if extension_is(&entry_path, "ese") {
            has_ese = true;
        }
    }

    Ok(has_sct && has_ese)
}

fn extract_imported_sector_files(
    zip_file_path: &Path,
    destination_folder: &Path,
) -> Result<Vec<String>, String> {
    clear_directory(destination_folder)?;

    validate_import_zip_file(zip_file_path)?;

    let zip_file = fs::File::open(zip_file_path).map_err(|error| {
        format!(
            "unable to open imported zip '{}': {}",
            zip_file_path.display(),
            error
        )
    })?;

    let mut archive = zip::ZipArchive::new(zip_file).map_err(|error| {
        format!(
            "unable to open imported zip archive: {}. Re-download the AeroNav zip and try again.",
            error
        )
    })?;

    let mut imported_names: Vec<String> = Vec::new();

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("unable to read imported zip entry: {}", error))?;

        if file.is_dir() {
            continue;
        }

        let Some(enclosed_name) = file.enclosed_name().map(|name| name.to_path_buf()) else {
            continue;
        };

        let Some(file_name) = enclosed_name.file_name().map(|name| name.to_owned()) else {
            continue;
        };

        let extension = enclosed_name
            .extension()
            .map(|value| value.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();

        if extension != "sct" && extension != "ese" {
            continue;
        }

        let output_path = destination_folder.join(&file_name);
        let mut output_file = fs::File::create(&output_path).map_err(|error| {
            format!(
                "unable to create imported sector file '{}': {}",
                output_path.display(),
                error
            )
        })?;

        io::copy(&mut file, &mut output_file).map_err(|error| {
            format!(
                "unable to extract imported sector file '{}': {}",
                output_path.display(),
                error
            )
        })?;

        imported_names.push(file_name.to_string_lossy().to_string());
    }

    if !has_required_sector_files(destination_folder)? {
        clear_directory(destination_folder)?;
        return Err(
            "import failed: zip must contain at least one .sct and one .ese file".to_string(),
        );
    }

    imported_names.sort();
    imported_names.dedup();

    Ok(imported_names)
}

fn inject_imported_sector_files(
    imported_sector_folder: &Path,
    content_root: &Path,
) -> Result<(), String> {
    if !has_required_sector_files(imported_sector_folder)? {
        return Err(
            "installation blocked: import sector files zip before installing update".to_string(),
        );
    }

    for entry in fs::read_dir(imported_sector_folder)
        .map_err(|error| format!("unable to read imported sector files folder: {}", error))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();

        if !source_path.is_file() {
            continue;
        }

        if !extension_is(&source_path, "sct") && !extension_is(&source_path, "ese") {
            continue;
        }

        let destination_path = content_root.join(entry.file_name());
        fs::copy(&source_path, &destination_path).map_err(|error| {
            format!(
                "unable to copy imported sector file '{}' to '{}': {}",
                source_path.display(),
                destination_path.display(),
                error
            )
        })?;
    }

    Ok(())
}

pub fn run_import_sector_files_from_zip(zip_path: String) -> Result<String, String> {
    let zip_file_path = PathBuf::from(zip_path);
    if !zip_file_path.is_file() {
        return Err("selected zip file does not exist".to_string());
    }

    if !extension_is(&zip_file_path, "zip") {
        return Err("selected file must be a .zip archive".to_string());
    }

    let imported_sector_folder = imported_sector_files_dir()?;
    let imported_names = extract_imported_sector_files(&zip_file_path, &imported_sector_folder)?;

    if imported_names.is_empty() {
        return Err("import failed: no sector files were extracted from zip".to_string());
    }

    Ok(format!(
        "Imported sector files: {}",
        imported_names.join(", ")
    ))
}

pub fn run_has_imported_sector_files() -> Result<bool, String> {
    let imported_sector_folder = imported_sector_files_dir()?;
    has_required_sector_files(&imported_sector_folder)
}

fn download_and_extract_latest_release(download_folder: &Path) -> Result<String, String> {
    clear_directory(download_folder)?;

    let release = fetch_latest_release(LATEST_RELEASE_API_URL, None)?;

    let download_url = release
        .assets
        .iter()
        .find(|asset| asset.name.to_ascii_lowercase().ends_with(".zip"))
        .map(|asset| asset.browser_download_url.clone())
        .unwrap_or_else(|| release.zipball_url.clone());

    let changelog = release.body.clone();

    let zip_bytes = download_bytes(&download_url, None)?;

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
    let release = fetch_latest_release(LATEST_RELEASE_API_URL, None)?;
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
            let destination = if extension_is(&source_path, "prf")
                || extension_is(&source_path, "sct")
                || extension_is(&source_path, "ese")
            {
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
    let download_folder = app_data_work_dir()?.join("download");
    let imported_sector_folder = imported_sector_files_dir()?;

    if !has_required_sector_files(&imported_sector_folder)? {
        return Err(
            "installation blocked: import the AeroNav sector zip before installing updates"
                .to_string(),
        );
    }

    let changelog = download_and_extract_latest_release(&download_folder)?;
    let content_root = find_airac_content_root(&download_folder)
        .ok_or_else(|| "downloaded release does not contain AIRAC content".to_string())?;
    inject_imported_sector_files(&imported_sector_folder, &content_root)?;

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

    if imported_sector_folder.exists() {
        fs::remove_dir_all(&imported_sector_folder).map_err(|error| {
            format!(
                "unable to remove imported sector files folder '{}': {}",
                imported_sector_folder.display(),
                error
            )
        })?;
    }

    Ok(changelog)
}
