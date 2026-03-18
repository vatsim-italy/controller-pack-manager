# VATITA Controller Pack Manager

VATITA Controller Pack Manager is a desktop utility for EuroScope users.

It helps you keep your EuroScope setup up to date by:
- managing AIRAC/controller-pack updates,
- updating the VATITA plugin,
- preserving and patching profile-related settings,
- managing TopSky Hoppie code.

## Main features

### AIRAC / Sector File Manager

- Detects installed AIRAC version.
- Checks if a newer AIRAC release is available.
- Installs update package content into your local EuroScope config.
- Requires sector files to be imported before installation (safe preflight gate).
- Opens the official AeroNav page for manual sector ZIP download.

Sector files (`.sct` / `.ese`) are **not** downloaded automatically by the app, due to legal reasons.

### Plugin Manager

- Detects installed VATITA plugin version.
- Shows plugin changelog and available installable version.
- Installs plugin updates from GitHub releases.
- Supports optional dev-release mode.

### Profiles

- Detects existing EuroScope profile files.
- Lets you update/clone/delete profiles while preserving key user data during updates.

### TopSky / Hoppie

- Reads and updates your Hoppie code used by TopSky CPDLC integration.

### Current compliant flow

1. Click **Download Update** in the AIRAC section (opens `https://files.aero-nav.com/LIXX`).
2. Sign in with the required provider on the website.
3. Download the official ZIP manually in your browser.
4. Back in the app, click **Import Update** and select that ZIP.
5. Click **Install Update**.

The installer is intentionally blocked until valid imported sector files are present.

## How to get the GitHub access token (for plugin updates)

Plugin updates are fetched from GitHub and require a personal access token.

### Steps

1. Open GitHub: **Settings → Developer settings → Personal access tokens**.
2. Create a token (classic or fine-grained, depending on your GitHub policy).
3. Grant **read access to repository contents/releases** for the plugin source repository.
4. Copy the token value.
5. In the app, open **Plugin → Set/Manage Token**, paste token, and save.

### Notes

- Without a token, plugin release metadata and updates are unavailable.
- If plugin updates fail, first verify token validity and repository access scope.