import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type PluginRelease = {
  id: number;
  title: string;
  changelog: string;
  artifacts: Array<{
    id: number;
    name: string;
  }>;
};

type PluginApiResponse = {
  dev: PluginRelease;
  latest: PluginRelease;
};

type PluginCache = {
  key: string | null;
  fetched: boolean;
  releases: PluginApiResponse | null;
  fetchError: string | null;
  lastCheckedAtMs: number | null;
  inFlightKey: string | null;
  inFlight: Promise<void> | null;
};

const pluginCache: PluginCache = {
  key: null,
  fetched: false,
  releases: null,
  fetchError: null,
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

export const usePluginUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [releases, setReleases] = useState<PluginApiResponse | null>(pluginCache.releases);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(pluginCache.fetchError);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [isDevReleasesOptedIn, setIsDevReleasesOptedIn] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(readPluginCachedLastChecked());
  const [settingsReady, setSettingsReady] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const buildCacheKey = useCallback((tokenAvailable: boolean, devOptIn: boolean) => {
    return `${tokenAvailable ? "1" : "0"}:${devOptIn ? "1" : "0"}`;
  }, []);

  const fetchReleasesWithFlags = useCallback(async (tokenAvailable: boolean, devOptIn: boolean, force = false) => {
    const cacheKey = buildCacheKey(tokenAvailable, devOptIn);

    if (!force && pluginCache.fetched && pluginCache.key === cacheKey) {
      setReleases(pluginCache.releases);
      setFetchError(pluginCache.fetchError);
      setLastCheckedAt(readPluginCachedLastChecked());
      return;
    }

    if (!force && pluginCache.inFlight && pluginCache.inFlightKey === cacheKey) {
      setIsLoadingReleases(true);
      await pluginCache.inFlight;
      setReleases(pluginCache.releases);
      setFetchError(pluginCache.fetchError);
      setLastCheckedAt(readPluginCachedLastChecked());
      setIsLoadingReleases(false);
      return;
    }

    if (!tokenAvailable) {
      setReleases(null);
      setFetchError("Provide a GitHub access token to access plugin releases.");
      const checkedAt = Date.now();
      setLastCheckedAt(new Date(checkedAt));

      pluginCache.key = cacheKey;
      pluginCache.fetched = true;
      pluginCache.releases = null;
      pluginCache.fetchError = "Provide a GitHub access token to access plugin releases.";
      pluginCache.lastCheckedAtMs = checkedAt;
      return;
    }

    setIsLoadingReleases(true);
    setFetchError(null);

    const request = (async () => {
      try {
        const releasesData = await invoke<PluginApiResponse>("fetch_plugin_releases");
        const checkedAt = Date.now();

        pluginCache.key = cacheKey;
        pluginCache.fetched = true;
        pluginCache.releases = releasesData;
        pluginCache.fetchError = null;
        pluginCache.lastCheckedAtMs = checkedAt;
      } catch (error) {
        const errorMessage = normalizeError(error);
        const checkedAt = Date.now();

        pluginCache.key = cacheKey;
        pluginCache.fetched = true;
        pluginCache.releases = null;
        pluginCache.fetchError = errorMessage;
        pluginCache.lastCheckedAtMs = checkedAt;
      }
    })();

    pluginCache.inFlightKey = cacheKey;
    pluginCache.inFlight = request;
    try {
      await request;
      setReleases(pluginCache.releases);
      setFetchError(pluginCache.fetchError);
      setLastCheckedAt(readPluginCachedLastChecked());
    } finally {
      pluginCache.inFlight = null;
      pluginCache.inFlightKey = null;
      setIsLoadingReleases(false);
    }
  }, [buildCacheKey]);

  const refreshSettings = useCallback(async () => {
    try {
      const [tokenAvailable, devOptIn, installedVer] = await Promise.all([
        invoke<boolean>("has_github_access_token"),
        invoke<boolean>("is_plugin_dev_releases_opted_in"),
        invoke<string | null>("get_installed_plugin_version"),
      ]);

      setHasGithubToken(tokenAvailable);
      setIsDevReleasesOptedIn(devOptIn);
      setInstalledVersion(installedVer ?? null);
      return { tokenAvailable, devOptIn };
    } catch (error) {
      console.error("Failed to refresh settings:", error);
      throw error;
    }
  }, []);

  const fetchLatestReleases = useCallback(async () => {
    await fetchReleasesWithFlags(hasGithubToken, isDevReleasesOptedIn);
  }, [fetchReleasesWithFlags, hasGithubToken, isDevReleasesOptedIn]);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        await refreshSettings();
      } finally {
        setIsLoadingSettings(false);
        setSettingsReady(true);
      }
    };

    void loadSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    void fetchLatestReleases();
  }, [fetchLatestReleases, settingsReady]);

  const toggleDevReleasesOptIn = async (optIn: boolean) => {
    setUpdateError(null);

    try {
      await invoke("set_plugin_dev_releases_opt_in_command", { optIn });
      setIsDevReleasesOptedIn(optIn);
      setUpdateSuccess(false);

      await fetchReleasesWithFlags(hasGithubToken, optIn, true);
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

    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const latestVersion = await invoke<string>("update_plugin_version");
      setUpdateSuccess(true);
      setInstalledVersion(latestVersion);
      await fetchReleasesWithFlags(hasGithubToken, isDevReleasesOptedIn, true);

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

  // Get the current release based on dev opt-in
  const currentRelease = releases
    ? (isDevReleasesOptedIn ? releases.dev : releases.latest)
    : null;

  // Determine if an update is available
  const hasUpdate = Boolean(
    currentRelease &&
    installedVersion &&
    currentRelease.title.trim() !== installedVersion.trim()
  );

  // Return the available version only if there's actually an update
  const availableVersionToReturn = hasUpdate ? currentRelease?.title ?? null : null;

  return {
    isUpdating,
    updateError,
    updateSuccess,
    updatePlugin,
    clearError,
    changelog: currentRelease?.changelog ?? null,
    isLoadingChangelog: isLoadingReleases,
    changelogError: fetchError,
    availableVersion: availableVersionToReturn,
    hasGithubToken,
    isDevReleasesOptedIn,
    toggleDevReleasesOptIn,
    lastCheckedAt,
    installedVersion,
    releases,
    isLoadingSettings,
  };
};

