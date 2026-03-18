use std::fs;
use std::path::Path;

pub fn should_skip_release_entry(name: &str) -> bool {
    let lower_name = name.to_ascii_lowercase();
    lower_name == "ignore"
        || lower_name == "crc_checksums.txt"
        || lower_name.contains("checksum")
        || lower_name.ends_with(".sha256")
        || lower_name.ends_with(".sha1")
        || lower_name.ends_with(".md5")
}

pub fn copy_dir_all(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "unable to create destination directory '{}': {}",
            destination.display(),
            error
        )
    })?;

    for entry in fs::read_dir(source).map_err(|error| {
        format!(
            "unable to read source directory '{}': {}",
            source.display(),
            error
        )
    })? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip_release_entry(&name) {
            continue;
        }

        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_all(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path).map_err(|error| {
                format!(
                    "unable to copy '{}' to '{}': {}",
                    source_path.display(),
                    destination_path.display(),
                    error
                )
            })?;
        }
    }

    Ok(())
}

pub fn clear_directory(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| {
            format!("unable to clear directory '{}': {}", path.display(), error)
        })?;
    }

    fs::create_dir_all(path)
        .map_err(|error| format!("unable to create directory '{}': {}", path.display(), error))
}
