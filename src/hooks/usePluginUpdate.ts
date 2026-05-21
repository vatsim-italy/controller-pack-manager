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
  dev: PluginRelease | null;
  latest: PluginRelease;
  history: Array<{
    digest: string;
    name: string;
  }>;
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

export type PluginUpdateState = {
  isUpdating: boolean;
  updateError: string | null;
  updateSuccess: boolean;
  releases: PluginApiResponse | null;
  isLoadingReleases: boolean;
  fetchError: string | null;
  changelog: string | null;
  isLoadingChangelog: boolean;
  changelogError: string | null;
  hasGithubToken: boolean;
  isDevReleasesOptedIn: boolean;
  lastCheckedAt: Date | null;
  installedVersion: string | null;
  availableVersion: string | null;
  isLoadingSettings: boolean;
  updatePlugin: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  clearError: () => void;
  toggleDevReleasesOptIn: (optIn: boolean) => Promise<void>;
};

export const usePluginUpdate = (): PluginUpdateState => {
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
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
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

  const refreshAvailableVersion = useCallback(async () => {
    const installableVersion = await invoke<string | null>("get_latest_plugin_installable_version");
    setAvailableVersion(installableVersion ?? null);
    return installableVersion ?? null;
  }, []);

  const fetchLatestReleases = useCallback(async () => {
    await fetchReleasesWithFlags(hasGithubToken, isDevReleasesOptedIn);
  }, [fetchReleasesWithFlags, hasGithubToken, isDevReleasesOptedIn]);

  const checkForUpdates = useCallback(async () => {
    setUpdateError(null);
    setUpdateSuccess(false);
    setIsLoadingReleases(true);

    try {
      const { tokenAvailable, devOptIn } = await refreshSettings();
      await Promise.all([
        fetchReleasesWithFlags(tokenAvailable, devOptIn, true),
        refreshAvailableVersion(),
      ]);
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsLoadingReleases(false);
      setLastCheckedAt(new Date());
    }
  }, [fetchReleasesWithFlags, refreshAvailableVersion, refreshSettings]);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        await refreshSettings();
        await refreshAvailableVersion();
      } catch (error) {
        setUpdateError(normalizeError(error));
      } finally {
        setIsLoadingSettings(false);
        setSettingsReady(true);
      }
    };

    void loadSettings();
  }, [refreshAvailableVersion, refreshSettings]);

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

      await Promise.all([
        fetchReleasesWithFlags(hasGithubToken, optIn, true),
        refreshAvailableVersion(),
      ]);
    } catch (error) {
      setUpdateError(normalizeError(error));
    }
  };

  const updatePlugin = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      if (!hasGithubToken) {
        throw new Error("Provide a GitHub access token before installing plugin updates.");
      }

      const latestVersion = await invoke<string>("update_plugin_version");
      setUpdateSuccess(true);
      setInstalledVersion(latestVersion);
      setAvailableVersion(null);
      await Promise.all([
        fetchReleasesWithFlags(hasGithubToken, isDevReleasesOptedIn, true),
        refreshAvailableVersion(),
      ]);
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsUpdating(false);
      setLastCheckedAt(new Date());
    }
  };

  const clearError = () => setUpdateError(null);

  useEffect(() => {
    if (!updateSuccess) {
      return;
    }

    const timer = setTimeout(() => setUpdateSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [updateSuccess]);

  // Get the current release based on dev opt-in
  const currentRelease = releases
    ? (isDevReleasesOptedIn ? releases.dev : releases.latest)
    : null;

  return {
    isUpdating,
    updateError,
    updateSuccess,
    releases,
    isLoadingReleases,
    fetchError,
    updatePlugin,
    checkForUpdates,
    clearError,
    changelog: currentRelease?.changelog ?? null,
    isLoadingChangelog: isLoadingReleases,
    changelogError: fetchError,
    availableVersion,
    hasGithubToken,
    isDevReleasesOptedIn,
    toggleDevReleasesOptIn,
    lastCheckedAt,
    installedVersion,
    isLoadingSettings,
  };
};

