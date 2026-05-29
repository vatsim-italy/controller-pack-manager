use serde::Deserialize;
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

fn build_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("unable to create http client: {}", error))
}

fn apply_github_headers(request: reqwest::blocking::RequestBuilder) -> reqwest::blocking::RequestBuilder {
    request
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", USER_AGENT)
}

pub fn fetch_latest_release(api_url: &str) -> Result<GitHubRelease, String> {
    let client = build_http_client()?;
    let request = client.get(api_url);

    apply_github_headers(request)
        .send()
        .map_err(|error| format!("unable to fetch latest release: {}", error))?
        .error_for_status()
        .map_err(|error| format!("latest release request failed: {}", error))?
        .json::<GitHubRelease>()
        .map_err(|error| format!("unable to parse latest release payload: {}", error))
}

pub fn download_bytes(download_url: &str) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    let request = client.get(download_url);

    apply_github_headers(request)
        .send()
        .map_err(|error| format!("unable to download release asset: {}", error))?
        .error_for_status()
        .map_err(|error| format!("release asset request failed: {}", error))?
        .bytes()
        .map_err(|error| format!("unable to read release zip content: {}", error))
        .map(|bytes| bytes.to_vec())
}

pub fn download_release_asset_bytes(asset_api_url: &str) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    let request = client
        .get(asset_api_url)
        .header("Accept", "application/octet-stream")
        .header("User-Agent", USER_AGENT);

    request
        .send()
        .map_err(|error| format!("unable to download release asset: {}", error))?
        .error_for_status()
        .map_err(|error| format!("release asset request failed: {}", error))?
        .bytes()
        .map_err(|error| format!("unable to read release asset content: {}", error))
        .map(|bytes| bytes.to_vec())
}
