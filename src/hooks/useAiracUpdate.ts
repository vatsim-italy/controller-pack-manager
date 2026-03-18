import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type AiracCache = {
  changelog: string | null;
  lastCheckedAtMs: number | null;
  fetched: boolean;
  inFlight: Promise<void> | null;
};

const airacCache: AiracCache = {
  changelog: null,
  lastCheckedAtMs: null,
  fetched: false,
  inFlight: null,
};

const readCachedLastChecked = () =>
  airacCache.lastCheckedAtMs ? new Date(airacCache.lastCheckedAtMs) : null;

export const useAiracUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [changelog, setChangelog] = useState<string | null>(airacCache.changelog);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(readCachedLastChecked());

  const normalizeChangelog = (value: string | null) => {
    if (!value || value.trim().length === 0) {
      return "No changelog notes were provided for this release.";
    }

    return value;
  };

  const fetchLatestChangelog = useCallback(async (force = false) => {
    if (!force && airacCache.fetched) {
      setChangelog(airacCache.changelog);
      setLastCheckedAt(readCachedLastChecked());
      return;
    }

    if (!force && airacCache.inFlight) {
      setIsLoadingChangelog(true);
      await airacCache.inFlight;
      setChangelog(airacCache.changelog);
      setLastCheckedAt(readCachedLastChecked());
      setIsLoadingChangelog(false);
      return;
    }

    setIsLoadingChangelog(true);

    const request = (async () => {
      try {
        const latestChangelog = await invoke<string>("get_latest_airac_changelog");
        const normalized = normalizeChangelog(latestChangelog);
        const checkedAt = Date.now();

        airacCache.changelog = normalized;
        airacCache.lastCheckedAtMs = checkedAt;
        airacCache.fetched = true;
      } catch {
        const checkedAt = Date.now();
        airacCache.changelog = null;
        airacCache.lastCheckedAtMs = checkedAt;
        airacCache.fetched = true;
      }
    })();

    airacCache.inFlight = request;
    try {
      await request;
      setChangelog(airacCache.changelog);
      setLastCheckedAt(readCachedLastChecked());
    } finally {
      airacCache.inFlight = null;
      setIsLoadingChangelog(false);
    }
  }, []);

  useEffect(() => {
    void fetchLatestChangelog();
  }, [fetchLatestChangelog]);

  const updateAirac = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const latestChangelog = await invoke<string | null>("update_airac_version");
      const normalized = normalizeChangelog(latestChangelog);
      const checkedAt = Date.now();

      setChangelog(normalized);
      setUpdateSuccess(true);

      airacCache.changelog = normalized;
      airacCache.lastCheckedAtMs = checkedAt;
      airacCache.fetched = true;

      // Auto-clear success message after 3 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 3000);
      return () => clearTimeout(timer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setUpdateError(errorMessage);
    } finally {
      setIsUpdating(false);
      setLastCheckedAt(readCachedLastChecked() ?? new Date());
    }
  };

  const checkForUpdates = async () => {
    await fetchLatestChangelog(true);
  };

  const clearError = () => setUpdateError(null);
  const clearSuccess = () => setUpdateSuccess(false);

  return {
    isUpdating,
    updateError,
    updateSuccess,
    updateAirac,
    checkForUpdates,
    clearError,
    clearSuccess,
    changelog,
    isLoadingChangelog,
    lastCheckedAt,
  };
};
