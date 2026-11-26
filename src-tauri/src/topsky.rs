use std::fs;
use std::path::{Path, PathBuf};

const HOPPIE_KEY: &str = "HOPPIE_LOGON=";

pub fn vcp_settings_path(euroscope_config_path: &Path) -> PathBuf {
    euroscope_config_path
        .join("LIXX")
        .join("Plugins")
        .join("VATITA Controller Plugin")
        .join("settings.txt")
}

/// Returns the HOPPIE_LOGON value from VCP settings.txt, if present and non-empty.
pub fn read_hoppie_code(euroscope_config_path: &Path) -> Option<String> {
    let content = fs::read_to_string(vcp_settings_path(euroscope_config_path)).ok()?;
    content
        .lines()
        .find_map(|line| line.trim().strip_prefix(HOPPIE_KEY))
        .map(|code| code.trim().to_string())
        .filter(|code| !code.is_empty())
}

/// Code from the old TopSky logon file, used to offer a one-time import into VCP settings.
pub fn read_legacy_topsky_hoppie_code(euroscope_config_path: &Path) -> Option<String> {
    [euroscope_config_path.join("LIXX"), euroscope_config_path.to_path_buf()]
        .iter()
        .filter_map(|base| {
            fs::read_to_string(base.join("Plugins").join("Topsky").join("TopSkyCPDLCHoppieCode.txt")).ok()
        })
        .map(|code| code.trim().to_string())
        .find(|code| !code.is_empty())
}

fn set_hoppie_line(content: &str, hoppie_code: &str) -> String {
    let new_line = format!("{}{}", HOPPIE_KEY, hoppie_code);
    let mut found = false;
    let mut lines: Vec<String> = content
        .lines()
        .map(|line| {
            if line.trim().starts_with(HOPPIE_KEY) {
                found = true;
                new_line.clone()
            } else {
                line.to_string()
            }
        })
        .collect();
    if !found {
        lines.push(new_line);
    }
    lines.join("\n") + "\n"
}

pub fn patch_hoppie_code(euroscope_config_path: &Path, hoppie_code: &str) -> Result<(), String> {
    let settings_path = vcp_settings_path(euroscope_config_path);

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "unable to create VCP settings directory '{}': {}",
                parent.display(),
                error
            )
        })?;
    }

    // Missing file is fine (fresh install); other read errors must not wipe the user's settings.
    let content = match fs::read_to_string(&settings_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => {
            return Err(format!(
                "unable to read VCP settings file '{}': {}",
                settings_path.display(),
                error
            ))
        }
    };

    fs::write(&settings_path, set_hoppie_line(&content, hoppie_code.trim())).map_err(|error| {
        format!(
            "unable to write VCP settings file '{}': {}",
            settings_path.display(),
            error
        )
    })
}

pub fn run_update_hoppie_code(hoppie_code: String) -> Result<(), String> {
    let normalized_code = hoppie_code.trim().to_string();
    if normalized_code.is_empty() {
        return Err("hoppie code cannot be empty".to_string());
    }

    let pack_dir = crate::app::AppState::resolve_euroscope_config_folder()
        .ok_or_else(|| "EuroScope folder not found".to_string())?;
    patch_hoppie_code(Path::new(&pack_dir), &normalized_code)
}

#[cfg(test)]
mod tests {
    use super::set_hoppie_line;

    #[test]
    fn replaces_existing_hoppie_line_and_keeps_others() {
        let out = set_hoppie_line("DEBUG=false\nHOPPIE_LOGON=\nRADIUS=9\n", "abc");
        assert_eq!(out, "DEBUG=false\nHOPPIE_LOGON=abc\nRADIUS=9\n");
    }

    #[test]
    fn appends_hoppie_line_when_missing() {
        assert_eq!(set_hoppie_line("DEBUG=false", "abc"), "DEBUG=false\nHOPPIE_LOGON=abc\n");
        assert_eq!(set_hoppie_line("", "abc"), "HOPPIE_LOGON=abc\n");
    }
}
