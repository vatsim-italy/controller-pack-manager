import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export const useAiracUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const updateAirac = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      await invoke("update_airac_version");
      setUpdateSuccess(true);
      // Auto-clear success message after 3 seconds
      const timer = setTimeout(() => setUpdateSuccess(false), 3000);
      return () => clearTimeout(timer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setUpdateError(errorMessage);
    } finally {
      setIsUpdating(false);
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
  };
};
