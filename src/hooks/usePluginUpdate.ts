import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  const [changelog, setChangelog] = useState<string | null>(null);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [isDevReleasesOptedIn, setIsDevReleasesOptedIn] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const fetchLatestChangelogWithFlags = useCallback(async (tokenAvailable: boolean, devOptIn: boolean) => {
    if (!tokenAvailable) {
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError("Provide a GitHub access token to access plugin releases.");
      setLastCheckedAt(new Date());
      return;
    }

    if (!devOptIn) {
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError(null);
      setLastCheckedAt(new Date());
      return;
    }

    setIsLoadingChangelog(true);
    setChangelogError(null);

    try {
      const [latestChangelog, latestInstallableVersion] = await Promise.all([
        invoke<string>("get_latest_plugin_changelog"),
        invoke<string | null>("get_latest_plugin_installable_version"),
      ]);
      setChangelog(normalizeChangelog(latestChangelog));
      setAvailableVersion(latestInstallableVersion);
    } catch (error) {
      setChangelog(null);
      setAvailableVersion(null);
      setChangelogError(normalizeError(error));
    } finally {
      setLastCheckedAt(new Date());
      setIsLoadingChangelog(false);
    }
  }, []);

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
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    void fetchLatestChangelog();
  }, [fetchLatestChangelog]);

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
      await fetchLatestChangelogWithFlags(tokenAvailable, devOptIn);
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

      await fetchLatestChangelogWithFlags(hasGithubToken, optIn);
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
      const latestChangelog = await invoke<string | null>("update_plugin_version");
      setChangelog(normalizeChangelog(latestChangelog));
      setUpdateSuccess(true);
      setChangelogError(null);
      await fetchLatestChangelogWithFlags(hasGithubToken, isDevReleasesOptedIn);

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
