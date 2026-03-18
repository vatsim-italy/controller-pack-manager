import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";

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

export const useAiracUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImportingSectorZip, setIsImportingSectorZip] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [sectorImportError, setSectorImportError] = useState<string | null>(null);
  const [sectorImportSuccess, setSectorImportSuccess] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [hasImportedSectorFiles, setHasImportedSectorFiles] = useState(false);
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

  const refreshImportedSectorFiles = useCallback(async () => {
    try {
      const isReady = await invoke<boolean>("has_imported_airac_sector_files");
      setHasImportedSectorFiles(isReady);
    } catch {
      setHasImportedSectorFiles(false);
    }
  }, []);

  useEffect(() => {
    void fetchLatestChangelog();
    void refreshImportedSectorFiles();
  }, [fetchLatestChangelog, refreshImportedSectorFiles]);

  const openSectorDownloadPage = async () => {
    setSectorImportError(null);

    try {
      await openUrl("https://files.aero-nav.com/LIXX");
    } catch (error) {
      setSectorImportError(normalizeError(error));
    }
  };

  const importSectorZip = async () => {
    setIsImportingSectorZip(true);
    setSectorImportError(null);
    setSectorImportSuccess(null);

    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      const message = await invoke<string>("import_airac_sector_zip", {
        zipPath: selectedPath,
      });

      setSectorImportSuccess(message);
      await refreshImportedSectorFiles();
    } catch (error) {
      setSectorImportError(normalizeError(error));
      await refreshImportedSectorFiles();
    } finally {
      setIsImportingSectorZip(false);
    }
  };

  const updateAirac = async () => {
    if (!hasImportedSectorFiles) {
      setUpdateError(
        "Import the AeroNav sector zip (.sct/.ese) before installing the update.",
      );
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const latestChangelog = await invoke<string | null>("update_airac_version");
      const normalized = normalizeChangelog(latestChangelog);
      const checkedAt = Date.now();

      setChangelog(normalized);
      setSectorImportSuccess(null);
      setUpdateSuccess(true);

      airacCache.changelog = normalized;
      airacCache.lastCheckedAtMs = checkedAt;
      airacCache.fetched = true;

      // Auto-clear success message after 3 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 3000);
      return () => clearTimeout(timer);
    } catch (error) {
      setUpdateError(normalizeError(error));
    } finally {
      setIsUpdating(false);
      setLastCheckedAt(readCachedLastChecked() ?? new Date());
      await refreshImportedSectorFiles();
    }
  };

  const checkForUpdates = async () => {
    await fetchLatestChangelog(true);
  };

  const clearError = () => {
    setUpdateError(null);
    setSectorImportError(null);
  };
  const clearSuccess = () => setUpdateSuccess(false);

  return {
    isUpdating,
    isImportingSectorZip,
    hasImportedSectorFiles,
    updateError,
    sectorImportError,
    sectorImportSuccess,
    updateSuccess,
    updateAirac,
    openSectorDownloadPage,
    importSectorZip,
    checkForUpdates,
    clearError,
    clearSuccess,
    changelog,
    isLoadingChangelog,
    lastCheckedAt,
  };
};
