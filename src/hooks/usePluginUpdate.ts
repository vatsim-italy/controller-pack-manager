import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type PluginCache = {
  key: string | null;
  fetched: boolean;
  changelog: string | null;
  changelogError: string | null;
  availableVersion: string | null;
  lastCheckedAtMs: number | null;
  inFlightKey: string | null;
  inFlight: Promise<void> | null;
};

const pluginCache: PluginCache = {
  key: null,
  fetched: false,
  changelog: null,
  changelogError: null,
  availableVersion: null,
  lastCheckedAtMs: null,
  inFlightKey: null,
  inFlight: null,
};

const readPluginCachedLastChecked = () =>
  pluginCache.lastCheckedAtMs ? new Date(pluginCache.lastCheckedAtMs) : null;

const normalizeError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    return JSON.stringify(error);
  }

  return String(error);
};

const normalizeChangelog = (value: string | null) => {
  if (!value || value.trim().length === 0) {
    return "No changelog notes were provided for this release.";
  }

  return value;
};

export const usePluginUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [changelog, setChangelog] = useState<string | null>(pluginCache.changelog);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(pluginCache.changelogError);
  const [availableVersion, setAvailableVersion] = useState<string | null>(pluginCache.availableVersion);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [isDevReleasesOptedIn, setIsDevReleasesOptedIn] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(readPluginCachedLastChecked());
  const [settingsReady, setSettingsReady] = useState(false);

  const buildCacheKey = useCallback((tokenAvailable: boolean, devOptIn: boolean) => {
    return `${tokenAvailable ? "1" : "0"}:${devOptIn ? "1" : "0"}`;
  }, []);

  const fetchLatestChangelogWithFlags = useCallback(async (tokenAvailable: boolean, devOptIn: boolean, force = false) => {
    const cacheKey = buildCacheKey(tokenAvailable, devOptIn);
    if (!force && pluginCache.fetched && pluginCache.key === cacheKey) {
      setChangelog(pluginCache.changelog);
      setAvailableVersion(pluginCache.availableVersion);
      setChangelogError(pluginCache.changelogError);
      setLastCheckedAt(readPluginCachedLastChecked());
      return;
    }

    if (!force && pluginCache.inFlight && pluginCache.inFlightKey === cacheKey) {
      setIsLoadingChangelog(true);
      await pluginCache.inFlight;
      setChangelog(pluginCache.changelog);
      setAvailableVersion(pluginCache.availableVersion);
      setChangelogError(pluginCache.changelogError);
      setLastCheckedAt(readPluginCachedLastChecked());
      setIsLoadingChangelog(false);
      return;
    }

    if (!tokenAvailable) {
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError("Provide a GitHub access token to access plugin releases.");
      const checkedAt = Date.now();
      setLastCheckedAt(new Date(checkedAt));

      pluginCache.key = cacheKey;
      pluginCache.fetched = true;
      pluginCache.changelog = null;
      pluginCache.availableVersion = null;
      pluginCache.changelogError = "Provide a GitHub access token to access plugin releases.";
      pluginCache.lastCheckedAtMs = checkedAt;
      return;
    }

    if (!devOptIn) {
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError(null);
      const checkedAt = Date.now();
      setLastCheckedAt(new Date(checkedAt));

      pluginCache.key = cacheKey;
      pluginCache.fetched = true;
      pluginCache.changelog = null;
      pluginCache.availableVersion = null;
      pluginCache.changelogError = null;
      pluginCache.lastCheckedAtMs = checkedAt;
      return;
    }

    setIsLoadingChangelog(true);
    setChangelogError(null);

    const request = (async () => {
      try {
        const [latestChangelog, latestInstallableVersion] = await Promise.all([
          invoke<string>("get_latest_plugin_changelog"),
          invoke<string | null>("get_latest_plugin_installable_version"),
        ]);
        const normalized = normalizeChangelog(latestChangelog);
        const checkedAt = Date.now();

        pluginCache.key = cacheKey;
        pluginCache.fetched = true;
        pluginCache.changelog = normalized;
        pluginCache.availableVersion = latestInstallableVersion;
        pluginCache.changelogError = null;
        pluginCache.lastCheckedAtMs = checkedAt;
      } catch (error) {
        const errorMessage = normalizeError(error);
        const checkedAt = Date.now();

        pluginCache.key = cacheKey;
        pluginCache.fetched = true;
        pluginCache.changelog = null;
        pluginCache.availableVersion = null;
        pluginCache.changelogError = errorMessage;
        pluginCache.lastCheckedAtMs = checkedAt;
      }
    })();

    pluginCache.inFlightKey = cacheKey;
    pluginCache.inFlight = request;
    try {
      await request;
      setChangelog(pluginCache.changelog);
      setAvailableVersion(pluginCache.availableVersion);
      setChangelogError(pluginCache.changelogError);
      setLastCheckedAt(readPluginCachedLastChecked());
    } finally {
      pluginCache.inFlight = null;
      pluginCache.inFlightKey = null;
      setIsLoadingChangelog(false);
    }
  }, [buildCacheKey]);

  const refreshSettings = useCallback(async () => {
    const [tokenAvailable, devOptIn] = await Promise.all([
      invoke<boolean>("has_github_access_token"),
      invoke<boolean>("is_plugin_dev_releases_opted_in"),
    ]);

    setHasGithubToken(tokenAvailable);
    setIsDevReleasesOptedIn(devOptIn);
    return { tokenAvailable, devOptIn };
  }, []);

  const fetchLatestChangelog = useCallback(async () => {
    await fetchLatestChangelogWithFlags(hasGithubToken, isDevReleasesOptedIn);
  }, [fetchLatestChangelogWithFlags, hasGithubToken, isDevReleasesOptedIn]);

  useEffect(() => {
    const loadSettings = async () => {
      await refreshSettings();
      setSettingsReady(true);
    };

    void loadSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    void fetchLatestChangelog();
  }, [fetchLatestChangelog, settingsReady]);

  const saveGithubToken = async () => {
    const normalizedToken = tokenInput.trim();
    if (!normalizedToken) {
      setUpdateError("GitHub token cannot be empty.");
      return;
    }

    setIsSavingToken(true);
    setUpdateError(null);

    try {
      await invoke("set_github_access_token", { token: normalizedToken });
      setTokenInput("");
      const { tokenAvailable, devOptIn } = await refreshSettings();
      await fetchLatestChangelogWithFlags(tokenAvailable, devOptIn, true);
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsSavingToken(false);
    }
  };

  const clearGithubToken = async () => {
    setIsSavingToken(true);
    setUpdateError(null);

    try {
      await invoke("clear_github_access_token");
      await refreshSettings();
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError("Provide a GitHub access token to access plugin releases.");
      pluginCache.fetched = false;
      pluginCache.key = null;
      pluginCache.inFlight = null;
      pluginCache.inFlightKey = null;
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsSavingToken(false);
    }
  };

  const toggleDevReleasesOptIn = async (optIn: boolean) => {
    setUpdateError(null);

    try {
      await invoke("set_plugin_dev_releases_opt_in_command", { optIn });
      setIsDevReleasesOptedIn(optIn);
      setUpdateSuccess(false);

      await fetchLatestChangelogWithFlags(hasGithubToken, optIn, true);
    } catch (error) {
      setUpdateError(normalizeError(error));
    }
  };

  const updatePlugin = async () => {
    if (!hasGithubToken) {
      setUpdateError("Provide a GitHub access token before installing plugin updates.");
      return;
    }

    if (!isDevReleasesOptedIn) {
      setUpdateError("Enable dev releases to install plugin updates from GitHub.");
      return;
    }

    if (!availableVersion) {
      setUpdateError(null);
      await fetchLatestChangelogWithFlags(hasGithubToken, isDevReleasesOptedIn, true);
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const latestChangelog = await invoke<string | null>("update_plugin_version");
      setChangelog(normalizeChangelog(latestChangelog));
      setUpdateSuccess(true);
      setChangelogError(null);
      await fetchLatestChangelogWithFlags(hasGithubToken, isDevReleasesOptedIn, true);

      const timer = setTimeout(() => setUpdateSuccess(false), 3000);
      return () => clearTimeout(timer);
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsUpdating(false);
      setLastCheckedAt(new Date());
    }
  };

  const clearError = () => setUpdateError(null);

  return {
    isUpdating,
    isSavingToken,
    updateError,
    updateSuccess,
    updatePlugin,
    clearError,
    changelog,
    isLoadingChangelog,
    changelogError,
    availableVersion,
    hasGithubToken,
    isDevReleasesOptedIn,
    tokenInput,
    setTokenInput,
    saveGithubToken,
    clearGithubToken,
    toggleDevReleasesOptIn,
    lastCheckedAt,
  };
};
