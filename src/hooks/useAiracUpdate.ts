import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export const useAiracUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [isLoadingChangelog, setIsLoadingChangelog] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const normalizeChangelog = (value: string | null) => {
    if (!value || value.trim().length === 0) {
      return "No changelog notes were provided for this release.";
    }

    return value;
  };

  const fetchLatestChangelog = useCallback(async () => {
    setIsLoadingChangelog(true);

    try {
      const latestChangelog = await invoke<string>("get_latest_airac_changelog");
      setChangelog(normalizeChangelog(latestChangelog));
      setLastCheckedAt(new Date());
    } catch {
      setChangelog(null);
      setLastCheckedAt(new Date());
    } finally {
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
      setChangelog(normalizeChangelog(latestChangelog));
      setUpdateSuccess(true);
      // Auto-clear success message after 3 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 3000);
      return () => clearTimeout(timer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setUpdateError(errorMessage);
    } finally {
      setIsUpdating(false);
      setLastCheckedAt(new Date());
    }
  };

  const clearError = () => setUpdateError(null);
  const clearSuccess = () => setUpdateSuccess(false);

  return {
    isUpdating,
    updateError,
    updateSuccess,
    updateAirac,
    clearError,
    clearSuccess,
    changelog,
    isLoadingChangelog,
    lastCheckedAt,
  };
};
