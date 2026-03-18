use crate::config::{read_config_or_default, update_config};
use serde::Deserialize;
use std::env;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct GitHubReleaseAsset {
    #[serde(default)]
    pub url: String,
    pub name: String,
    #[serde(default)]
    pub browser_download_url: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubRelease {
    #[serde(default)]
    pub tag_name: String,
    #[serde(default)]
    pub zipball_url: String,
    #[serde(default)]
    pub assets: Vec<GitHubReleaseAsset>,
    #[serde(default)]
    pub body: String,
}

const USER_AGENT: &str = "controller-pack-manager";

pub fn resolve_github_token() -> Option<String> {
    let env_token = env::var("VATITA_GITHUB_TOKEN")
        .ok()
        .or_else(|| env::var("GITHUB_TOKEN").ok())
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty());

    if env_token.is_some() {
        return env_token;
    }

    read_config_or_default()
        .ok()
        .and_then(|config| config.github_access_token)
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
}

pub fn store_github_token(token: &str) -> Result<(), String> {
    let normalized = token.trim();
    if normalized.is_empty() {
        return Err("github token cannot be empty".to_string());
    }

    update_config(|config| {
        config.github_access_token = Some(normalized.to_string());
    })
    .map(|_| ())
}

pub fn clear_stored_github_token() -> Result<(), String> {
    update_config(|config| {
        config.github_access_token = None;
    })
    .map(|_| ())
}

fn build_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))
}

fn apply_github_headers(
    request: reqwest::blocking::RequestBuilder,
    token: Option<&str>,
) -> reqwest::blocking::RequestBuilder {
    let request = request
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", USER_AGENT);

    if let Some(token) = token {
        return request.bearer_auth(token);
    }

    request
}

pub fn fetch_latest_release(api_url: &str, token: Option<&str>) -> Result<GitHubRelease, String> {
    let client = build_http_client()?;
    let request = client.get(api_url);

    apply_github_headers(request, token)
        .send()
        .map_err(|error| format!("unable to fetch latest release: {}", error))?
        .error_for_status()
        .map_err(|error| format!("latest release request failed: {}", error))?
        .json::<GitHubRelease>()
        .map_err(|error| format!("unable to parse latest release payload: {}", error))
}

pub fn download_bytes(download_url: &str, token: Option<&str>) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    let request = client.get(download_url);

    apply_github_headers(request, token)
        .send()
        .map_err(|error| format!("unable to download release asset: {}", error))?
        .error_for_status()
        .map_err(|error| format!("release asset request failed: {}", error))?
        .bytes()
        .map_err(|error| format!("unable to read release zip content: {}", error))
        .map(|bytes| bytes.to_vec())
}

pub fn download_release_asset_bytes(
    asset_api_url: &str,
    token: Option<&str>,
) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    let request = client
        .get(asset_api_url)
        .header("Accept", "application/octet-stream")
        .header("User-Agent", USER_AGENT);

    let request = if let Some(token) = token {
        request.bearer_auth(token)
    } else {
        request
    };

    request
        .send()
        .map_err(|error| format!("unable to download release asset: {}", error))?
        .error_for_status()
        .map_err(|error| format!("release asset request failed: {}", error))?
        .bytes()
        .map_err(|error| format!("unable to read release asset content: {}", error))
        .map(|bytes| bytes.to_vec())
}
