use std::fs;
use std::path::Path;

pub fn patch_hoppie_code(euroscope_config_path: &Path, hoppie_code: &str) -> Result<(), String> {
    let hoppie_file_path = euroscope_config_path
        .join("LIXX")
        .join("Plugins")
        .join("Topsky")
        .join("TopSkyCPDLCHoppieCode.txt");

    if let Some(parent) = hoppie_file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "unable to create hoppie code directory '{}': {}",
                parent.display(),
                error
            )
        })?;
    }

    fs::write(&hoppie_file_path, hoppie_code).map_err(|error| {
        format!(
            "unable to write hoppie code file '{}': {}",
            hoppie_file_path.display(),
            error
        )
    })
}
